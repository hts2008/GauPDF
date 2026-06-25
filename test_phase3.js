// test_phase3.js
import fs from 'fs/promises';
import { PDFDocument } from 'pdf-lib';
import { encryptPdf, getBookmarks, setBookmarks, applyRedactions } from './src/main/file-manager.js';

async function runTest() {
  console.log('--- Phase 3 Features Verification Test ---');

  // 1. Create a dummy PDF file
  const pdfDoc = await PDFDocument.create();
  const page1 = pdfDoc.addPage([600, 800]);
  page1.drawText('This is page 1 content.', { x: 50, y: 700 });
  const page2 = pdfDoc.addPage([600, 800]);
  page2.drawText('This is page 2 content.', { x: 50, y: 700 });
  const initialBytes = await pdfDoc.save();
  
  const testInputPath = 'test_input.pdf';
  await fs.writeFile(testInputPath, initialBytes);
  console.log('Created test_input.pdf');

  // 2. Test Bookmarks (setBookmarks and getBookmarks)
  console.log('Testing Bookmarks...');
  const bookmarksToWrite = [
    {
      title: 'Chapter 1: Page 1 Welcome',
      pageIndex: 0,
      children: [
        {
          title: 'Sub-chapter 1.1',
          pageIndex: 0,
          children: []
        }
      ]
    },
    {
      title: 'Chapter 2: Page 2 Content',
      pageIndex: 1,
      children: []
    }
  ];

  await setBookmarks(testInputPath, bookmarksToWrite, 'test_bookmarked.pdf');
  console.log('Successfully wrote bookmarks to test_bookmarked.pdf');

  const readBookmarks = await getBookmarks('test_bookmarked.pdf');
  console.log('Read bookmarks from PDF:', JSON.stringify(readBookmarks, null, 2));

  // Verification checks for bookmarks
  if (readBookmarks.length !== 2) {
    throw new Error(`Expected 2 top level bookmarks, got ${readBookmarks.length}`);
  }
  if (readBookmarks[0].title !== 'Chapter 1: Page 1 Welcome' || readBookmarks[0].pageIndex !== 0) {
    throw new Error('Top bookmark 0 fields mismatch');
  }
  if (readBookmarks[0].children.length !== 1 || readBookmarks[0].children[0].title !== 'Sub-chapter 1.1') {
    throw new Error('Nested bookmark mismatch');
  }
  if (readBookmarks[1].title !== 'Chapter 2: Page 2 Content' || readBookmarks[1].pageIndex !== 1) {
    throw new Error('Top bookmark 1 fields mismatch');
  }
  console.log('Bookmarks Test Passed!');

  // 3. Test Redaction
  console.log('Testing Redaction...');
  const redactions = [
    {
      pageIndex: 0,
      x: 50,
      y: 100,
      width: 100,
      height: 50,
      isTopLeft: true
    }
  ];
  await applyRedactions('test_bookmarked.pdf', redactions, 'test_redacted.pdf');
  console.log('Successfully applied redaction and saved to test_redacted.pdf');

  // 4. Test Encryption
  console.log('Testing Encryption...');
  await encryptPdf('test_redacted.pdf', {
    userPassword: 'user123',
    ownerPassword: 'owner123',
    outputPath: 'test_secured.pdf'
  });
  console.log('Successfully encrypted PDF and saved to test_secured.pdf');

  // Verify that test_secured.pdf is encrypted (it should throw an error when loading without password)
  let loadFailed = false;
  try {
    const encryptedBytes = await fs.readFile('test_secured.pdf');
    await PDFDocument.load(encryptedBytes);
  } catch (err) {
    loadFailed = true;
    console.log('PDF loading correctly failed as expected without password. Error:', err.message);
  }

  if (!loadFailed) {
    throw new Error('Expected PDFDocument.load to fail on encrypted PDF without password');
  }
  console.log('Encryption Test Passed!');

  // Clean up
  await fs.unlink(testInputPath);
  await fs.unlink('test_bookmarked.pdf');
  await fs.unlink('test_redacted.pdf');
  await fs.unlink('test_secured.pdf');
  console.log('Cleaned up temporary test files.');

  console.log('--- All Verification Tests Passed Successfully! ---');
}

runTest().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});

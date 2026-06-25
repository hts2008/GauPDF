// src/main/file-manager.js
import { app, dialog } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import chokidar from 'chokidar';
import { PDFDocument } from 'pdf-lib';
import { createWorker } from 'tesseract.js';
import store from './store.js';
import { IPC_CHANNELS } from '../shared/constants.js';

const watchers = new Map();

/**
 * Helper to get the recovery drafts directory
 */
function getRecoveryDir() {
  return path.join(app.getPath('userData'), 'recovery');
}

/**
 * Add a path to the recent files list in store
 */
function addToRecentFiles(filePath) {
  let recent = store.get('recentFiles') || [];
  recent = recent.filter(p => p !== filePath);
  recent.unshift(filePath);
  if (recent.length > 10) {
    recent = recent.slice(0, 10);
  }
  store.set('recentFiles', recent);
}

/**
 * Open a PDF file using system dialog
 */
export async function openFile(browserWindow) {
  const result = await dialog.showOpenDialog(browserWindow, {
    title: 'Open PDF Document',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const data = await fs.readFile(filePath);
  addToRecentFiles(filePath);

  return {
    filePath,
    name: path.basename(filePath),
    data: new Uint8Array(data)
  };
}

/**
 * Save data to an existing file path
 */
export async function saveFile(filePath, data) {
  // data can be a Uint8Array or Buffer
  await fs.writeFile(filePath, Buffer.from(data));
  await clearTempCopy(filePath);
  return { success: true, filePath };
}

/**
 * Show Save As dialog and save data
 */
export async function saveFileAs(browserWindow, data, defaultPath) {
  const result = await dialog.showSaveDialog(browserWindow, {
    title: 'Save PDF Document As',
    defaultPath: defaultPath || 'document.pdf',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  const filePath = result.filePath;
  await fs.writeFile(filePath, Buffer.from(data));
  addToRecentFiles(filePath);
  
  if (defaultPath) {
    await clearTempCopy(defaultPath);
  }

  return {
    filePath,
    name: path.basename(filePath)
  };
}

/**
 * Setup a file watcher to notify the renderer if a file is modified externally
 */
export function watchFile(filePath, webContents) {
  if (watchers.has(filePath)) {
    watchers.get(filePath).close();
  }

  const watcher = chokidar.watch(filePath, { persistent: true });
  watcher.on('change', () => {
    if (!webContents.isDestroyed()) {
      webContents.send(IPC_CHANNELS.FILE_CHANGED, filePath);
    }
  });

  watchers.set(filePath, watcher);
}

/**
 * Stop watching a file
 */
export function unwatchFile(filePath) {
  if (watchers.has(filePath)) {
    watchers.get(filePath).close();
    watchers.delete(filePath);
  }
}

/**
 * Clean up all file watchers
 */
export function clearAllWatchers() {
  for (const watcher of watchers.values()) {
    watcher.close();
  }
  watchers.clear();
}

/**
 * Save auto-save draft/temp copy for crash recovery
 */
export async function saveTempCopy(originalPath, data) {
  const recoveryDir = getRecoveryDir();
  await fs.mkdir(recoveryDir, { recursive: true });

  const safeName = Buffer.from(originalPath).toString('hex') + '.tmp';
  const tempPath = path.join(recoveryDir, safeName);

  await fs.writeFile(tempPath, Buffer.from(data));

  const recoveryMap = store.get('recoveryMap') || {};
  recoveryMap[safeName] = {
    originalPath,
    tempPath,
    timestamp: Date.now()
  };
  store.set('recoveryMap', recoveryMap);
  return tempPath;
}

/**
 * Remove temp copy when file is safely saved or closed
 */
export async function clearTempCopy(originalPath) {
  const recoveryDir = getRecoveryDir();
  const safeName = Buffer.from(originalPath).toString('hex') + '.tmp';
  const tempPath = path.join(recoveryDir, safeName);

  try {
    await fs.unlink(tempPath);
  } catch (e) {
    // File may not exist or already deleted
  }

  const recoveryMap = store.get('recoveryMap') || {};
  delete recoveryMap[safeName];
  store.set('recoveryMap', recoveryMap);
}

/**
 * Check for recovery files on application start
 */
export async function checkRecoveryFiles() {
  const recoveryMap = store.get('recoveryMap') || {};
  const recoveryList = [];

  for (const [safeName, info] of Object.entries(recoveryMap)) {
    try {
      await fs.access(info.tempPath);
      recoveryList.push({
        originalPath: info.originalPath,
        tempPath: info.tempPath,
        timestamp: info.timestamp
      });
    } catch (e) {
      // File does not exist anymore, clean up entry
      delete recoveryMap[safeName];
    }
  }
  store.set('recoveryMap', recoveryMap);
  return recoveryList;
}

/**
 * Merge multiple PDF documents into a single document
 */
export async function mergePDFs(browserWindow, filePaths) {
  if (!filePaths || filePaths.length === 0) {
    return null;
  }

  const result = await dialog.showSaveDialog(browserWindow, {
    title: 'Save Merged PDF',
    defaultPath: 'merged.pdf',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  const outputPath = result.filePath;
  const mergedPdf = await PDFDocument.create();

  for (const filePath of filePaths) {
    const bytes = await fs.readFile(filePath);
    const pdf = await PDFDocument.load(bytes);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const mergedPdfBytes = await mergedPdf.save({ useObjectStreams: true });
  await fs.writeFile(outputPath, mergedPdfBytes);
  addToRecentFiles(outputPath);

  return {
    filePath: outputPath,
    name: path.basename(outputPath)
  };
}

/**
 * Split a PDF document into multiple documents based on page ranges
 */
export async function splitPDF(browserWindow, filePath, ranges) {
  // ranges: Array of { start: number, end: number, name: string } (0-indexed)
  if (!filePath || !ranges || ranges.length === 0) {
    return null;
  }

  const result = await dialog.showOpenDialog(browserWindow, {
    title: 'Select Destination Folder for Split PDFs',
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const outputDir = result.filePaths[0];
  const bytes = await fs.readFile(filePath);
  const pdf = await PDFDocument.load(bytes);
  const totalPages = pdf.getPageCount();
  const createdFiles = [];

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    const newPdf = await PDFDocument.create();

    const start = Math.max(0, parseInt(range.start, 10));
    const end = Math.min(totalPages - 1, parseInt(range.end, 10));

    if (start > end) continue;

    const pageIndices = [];
    for (let p = start; p <= end; p++) {
      pageIndices.push(p);
    }

    const copiedPages = await newPdf.copyPages(pdf, pageIndices);
    copiedPages.forEach((page) => newPdf.addPage(page));

    const newBytes = await newPdf.save({ useObjectStreams: true });
    const fileName = range.name || `${path.basename(filePath, '.pdf')}_part_${i + 1}.pdf`;
    const outPath = path.join(outputDir, fileName);

    await fs.writeFile(outPath, newBytes);
    addToRecentFiles(outPath);
    createdFiles.push({ filePath: outPath, name: fileName });
  }

  return createdFiles;
}

/**
 * Compress a PDF document by re-saving with optimized object streams
 */
export async function compressPDF(browserWindow, filePath) {
  if (!filePath) return null;

  const result = await dialog.showSaveDialog(browserWindow, {
    title: 'Save Compressed PDF As',
    defaultPath: `${path.basename(filePath, '.pdf')}_compressed.pdf`,
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  const outputPath = result.filePath;
  const bytes = await fs.readFile(filePath);
  const pdf = await PDFDocument.load(bytes);

  const compressedBytes = await pdf.save({
    useObjectStreams: true,
    addGlyphsToSansSerifFont: false
  });

  await fs.writeFile(outputPath, compressedBytes);
  addToRecentFiles(outputPath);

  return {
    filePath: outputPath,
    name: path.basename(outputPath)
  };
}

/**
 * Execute OCR text recognition on an image buffer or path
 */
export async function executeOCR(imageBufferOrPath, language = 'eng') {
  try {
    const worker = await createWorker(language);
    const result = await worker.recognize(imageBufferOrPath);
    await worker.terminate();
    return result.data.text;
  } catch (error) {
    console.error('OCR Execution Failed:', error);
    throw error;
  }
}

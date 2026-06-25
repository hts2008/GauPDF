// src/main/file-manager.js
import { app, dialog } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import chokidar from 'chokidar';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
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
 * Setup a file watcher to notify the renderer if a file is modified externally.
 * Multi-window safe: keyed by webContents.id and filePath.
 */
export function watchFile(filePath, webContents) {
  if (!webContents || webContents.isDestroyed()) return;
  const key = `${webContents.id}:${filePath}`;
  if (watchers.has(key)) {
    watchers.get(key).close();
  }

  const watcher = chokidar.watch(filePath, { persistent: true, ignoreInitial: true });
  watcher.on('change', () => {
    if (!webContents.isDestroyed()) {
      console.log(`[File Watcher] File changed externally: ${filePath}. Notifying window.`);
      webContents.send(IPC_CHANNELS.FILE_CHANGED, filePath);
    }
  });

  watchers.set(key, watcher);
}

/**
 * Stop watching a file for a specific window
 */
export function unwatchFile(filePath, webContents) {
  if (!webContents) return;
  const key = `${webContents.id}:${filePath}`;
  if (watchers.has(key)) {
    watchers.get(key).close();
    watchers.delete(key);
  }
}

/**
 * Stop all watchers for a specific window
 */
export function clearWatchersForWindow(webContents) {
  if (!webContents) return;
  const prefix = `${webContents.id}:`;
  for (const [key, watcher] of watchers.entries()) {
    if (key.startsWith(prefix)) {
      watcher.close();
      watchers.delete(key);
    }
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

/**
 * Low-level: Apply watermark to a PDF's byte array
 */
export async function applyWatermark(pdfBytes, options = {}) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const type = options.type || 'text';

  if (type === 'text') {
    const text = options.text || 'CONFIDENTIAL';
    const fontName = options.fontName || 'Helvetica';
    
    const fontMapping = {
      'Helvetica': StandardFonts.Helvetica,
      'Helvetica-Bold': StandardFonts.HelveticaBold,
      'Times-Roman': StandardFonts.TimesRoman,
      'Times-Bold': StandardFonts.TimesRomanBold,
      'Courier': StandardFonts.Courier,
      'Courier-Bold': StandardFonts.CourierBold
    };
    const standardFont = fontMapping[fontName] || StandardFonts.Helvetica;
    const fontObj = await pdfDoc.embedFont(standardFont);
    
    const size = options.fontSize || 50;
    const rotationDegrees = options.rotation !== undefined ? options.rotation : 45;
    const opacity = options.opacity !== undefined ? options.opacity : 0.3;
    
    let textColor = rgb(0.5, 0.5, 0.5);
    if (options.color) {
      if (Array.isArray(options.color)) {
        textColor = rgb(options.color[0], options.color[1], options.color[2]);
      } else if (typeof options.color === 'object') {
        textColor = rgb(
          options.color.r !== undefined ? options.color.r : 0.5,
          options.color.g !== undefined ? options.color.g : 0.5,
          options.color.b !== undefined ? options.color.b : 0.5
        );
      }
    }

    const textWidth = fontObj.widthOfTextAtSize(text, size);
    const textHeight = fontObj.heightAtSize(size);

    for (const page of pages) {
      const { width, height } = page.getSize();
      
      const rad = (rotationDegrees * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      
      const rotatedWidth = Math.abs(textWidth * cos) + Math.abs(textHeight * sin);
      const rotatedHeight = Math.abs(textWidth * sin) + Math.abs(textHeight * cos);
      
      const x = (width - rotatedWidth) / 2 + Math.abs(textHeight * sin) / 2;
      const y = (height - rotatedHeight) / 2;

      page.drawText(text, {
        x: options.x !== undefined ? options.x : x,
        y: options.y !== undefined ? options.y : y,
        size,
        font: fontObj,
        color: textColor,
        rotate: degrees(rotationDegrees),
        opacity
      });
    }
  } else if (type === 'image') {
    let imageBytes = options.imageBytes;
    if (!imageBytes && options.imagePath) {
      imageBytes = await fs.readFile(options.imagePath);
    }
    
    if (!imageBytes) {
      throw new Error('Image bytes or imagePath is required for image watermark');
    }

    const imageType = (options.imageType || 'png').toLowerCase();
    let embeddedImage;
    if (imageType === 'png') {
      embeddedImage = await pdfDoc.embedPng(imageBytes);
    } else if (imageType === 'jpg' || imageType === 'jpeg') {
      embeddedImage = await pdfDoc.embedJpg(imageBytes);
    } else {
      throw new Error(`Unsupported image type for watermark: ${imageType}`);
    }

    const scale = options.scale || 1.0;
    const imageDims = embeddedImage.scale(scale);
    const opacity = options.opacity !== undefined ? options.opacity : 0.3;

    for (const page of pages) {
      const { width, height } = page.getSize();
      
      const x = options.x !== undefined ? options.x : (width - imageDims.width) / 2;
      const y = options.y !== undefined ? options.y : (height - imageDims.height) / 2;

      page.drawImage(embeddedImage, {
        x,
        y,
        width: imageDims.width,
        height: imageDims.height,
        opacity
      });
    }
  }

  return await pdfDoc.save({ useObjectStreams: true });
}

/**
 * Low-level: Apply headers/footers to a PDF's byte array
 */
export async function applyHeaderFooter(pdfBytes, options = {}) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;

  const fontName = options.fontName || 'Helvetica';
  const fontMapping = {
    'Helvetica': StandardFonts.Helvetica,
    'Helvetica-Bold': StandardFonts.HelveticaBold,
    'Times-Roman': StandardFonts.TimesRoman,
    'Times-Bold': StandardFonts.TimesRomanBold,
    'Courier': StandardFonts.Courier,
    'Courier-Bold': StandardFonts.CourierBold
  };
  const standardFont = fontMapping[fontName] || StandardFonts.Helvetica;
  const fontObj = await pdfDoc.embedFont(standardFont);
  
  const size = options.fontSize || 9;
  const margin = options.margin !== undefined ? options.margin : 30;
  
  let textColor = rgb(0.3, 0.3, 0.3);
  if (options.color) {
    if (Array.isArray(options.color)) {
      textColor = rgb(options.color[0], options.color[1], options.color[2]);
    } else if (typeof options.color === 'object') {
      textColor = rgb(
        options.color.r !== undefined ? options.color.r : 0.3,
        options.color.g !== undefined ? options.color.g : 0.3,
        options.color.b !== undefined ? options.color.b : 0.3
      );
    }
  }

  for (let i = 0; i < totalPages; i++) {
    if (i === 0 && options.excludeFirstPage) {
      continue;
    }

    const page = pages[i];
    const { width, height } = page.getSize();

    // Draw header text
    if (options.headerText) {
      const textWidth = fontObj.widthOfTextAtSize(options.headerText, size);
      const x = options.headerAlign === 'left' ? margin :
                options.headerAlign === 'right' ? (width - textWidth - margin) :
                (width - textWidth) / 2; // default center
      page.drawText(options.headerText, {
        x,
        y: height - margin,
        size,
        font: fontObj,
        color: textColor
      });
    }

    // Draw footer text
    let footerText = options.footerText || '';
    if (options.showPageNumbers) {
      const pageNumStr = (options.pageNumberFormat || 'Page {page} of {total}')
        .replace('{page}', String(i + 1))
        .replace('{total}', String(totalPages));
      
      if (footerText) {
        footerText = `${footerText} | ${pageNumStr}`;
      } else {
        footerText = pageNumStr;
      }
    }

    if (footerText) {
      const textWidth = fontObj.widthOfTextAtSize(footerText, size);
      const x = options.footerAlign === 'left' ? margin :
                options.footerAlign === 'right' ? (width - textWidth - margin) :
                (width - textWidth) / 2; // default center
      page.drawText(footerText, {
        x,
        y: margin,
        size,
        font: fontObj,
        color: textColor
      });
    }
  }

  return await pdfDoc.save({ useObjectStreams: true });
}

/**
 * Add watermark to a PDF file and save it
 */
export async function addWatermark(filePath, options = {}, outputPath = null) {
  const bytes = await fs.readFile(filePath);
  const modifiedBytes = await applyWatermark(bytes, options);
  const targetPath = outputPath || filePath;
  await fs.writeFile(targetPath, Buffer.from(modifiedBytes));
  return { success: true, filePath: targetPath };
}

/**
 * Add headers/footers to a PDF file and save it
 */
export async function addHeaderFooter(filePath, options = {}, outputPath = null) {
  const bytes = await fs.readFile(filePath);
  const modifiedBytes = await applyHeaderFooter(bytes, options);
  const targetPath = outputPath || filePath;
  await fs.writeFile(targetPath, Buffer.from(modifiedBytes));
  return { success: true, filePath: targetPath };
}

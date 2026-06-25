// src/main/print-manager.js
import { BrowserWindow, dialog } from 'electron';
import fs from 'fs/promises';
import path from 'path';

/**
 * Get list of system printers
 */
export async function getPrinters(browserWindow) {
  if (!browserWindow) return [];
  return await browserWindow.webContents.getPrintersAsync();
}

/**
 * Execute native print on a browser window's web contents
 */
export async function printExecute(browserWindow, options = {}) {
  return new Promise((resolve, reject) => {
    const printOptions = {
      silent: options.silent || false,
      printBackground: options.printBackground !== false, // default to true
      deviceName: options.deviceName || '',
      color: options.color !== false,
      margins: options.margins || { marginType: 'default' },
      landscape: options.landscape || false,
      scaleFactor: options.scaleFactor || 100,
      pagesPerSheet: options.pagesPerSheet || 1,
      collate: options.collate || false,
      copies: options.copies || 1,
      pageRanges: options.pageRanges || []
    };

    browserWindow.webContents.print(printOptions, (success, errorType) => {
      if (success) {
        resolve({ success: true });
      } else {
        reject(new Error(`Print failed: ${errorType || 'Unknown error'}`));
      }
    });
  });
}

/**
 * Print web contents to a PDF file buffer
 */
export async function printToPDF(browserWindow, options = {}) {
  if (!browserWindow) throw new Error('No window target for PDF print');

  const pdfOptions = {
    landscape: options.landscape || false,
    displayHeaderFooter: options.displayHeaderFooter || false,
    printBackground: options.printBackground !== false,
    scale: options.scale || 1,
    pageSize: options.pageSize || 'A4',
    margins: options.margins || { marginType: 'default' },
    pageRanges: options.pageRanges || '',
    headerTemplate: options.headerTemplate || '',
    footerTemplate: options.footerTemplate || ''
  };

  const data = await browserWindow.webContents.printToPDF(pdfOptions);
  return new Uint8Array(data);
}

/**
 * Print a local PDF file by loading it in a temporary window (optional utility)
 */
export async function printPDFFile(filePath, options = {}) {
  return new Promise((resolve, reject) => {
    const tempWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });

    // We can load the file via standard file protocol. Note: Electron needs special flags or schemes sometimes,
    // but local file:// usually works for standard assets in main.
    tempWindow.loadURL(`file://${filePath}`);

    tempWindow.webContents.once('did-finish-load', () => {
      tempWindow.webContents.print(options, (success, errorType) => {
        tempWindow.destroy();
        if (success) {
          resolve({ success: true });
        } else {
          reject(new Error(`Print file failed: ${errorType}`));
        }
      });
    });

    tempWindow.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
      tempWindow.destroy();
      reject(new Error(`Failed to load document for printing: ${errorDescription}`));
    });
  });
}

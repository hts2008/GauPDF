// src/main/ipc-handlers.js
import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../shared/constants.js';
import {
  openFile,
  saveFile,
  saveFileAs,
  watchFile,
  unwatchFile,
  saveTempCopy,
  clearTempCopy,
  checkRecoveryFiles,
  mergePDFs,
  splitPDF,
  compressPDF,
  executeOCR,
  addWatermark,
  addHeaderFooter,
  encryptPdf,
  getBookmarks,
  setBookmarks,
  applyRedactions
} from './file-manager.js';
import { convertToPdf, convertFromPdf } from './libreoffice-service.js';
import { getPrinters, printExecute, printToPDF } from './print-manager.js';
import store from './store.js';
import WindowManager from './window-manager.js';

export function registerIpcHandlers() {
  console.log('[IPC Handlers] Registering IPC events and handlers');

  // Helper to resolve window from event sender
  const getWindow = (event) => {
    return BrowserWindow.fromWebContents(event.sender);
  };

  // --- Secure Multi-Window API ---
  ipcMain.handle('app:open-file-window', async (event, filePath) => {
    console.log(`[IPC] app:open-file-window requested for: ${filePath}`);
    if (filePath) {
      WindowManager.createDocumentWindow(filePath);
      return { success: true };
    }
    return { success: false, error: 'No file path provided' };
  });

  ipcMain.handle('pdf:create-blank', async (event) => {
    console.log('[IPC] pdf:create-blank requested');
    try {
      const { PDFDocument } = await import('pdf-lib');
      const fs = await import('fs/promises');
      const path = await import('path');
      const { app } = await import('electron');

      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([595.276, 841.89]); // A4 dimensions in points
      const pdfBytes = await pdfDoc.save();

      const tempDir = path.join(app.getPath('userData'), 'temp');
      await fs.mkdir(tempDir, { recursive: true });
      const tempPath = path.join(tempDir, `Untitled_${Date.now()}.pdf`);
      await fs.writeFile(tempPath, pdfBytes);

      WindowManager.createDocumentWindow(tempPath, true); // Open as new/temp document
      return { success: true, filePath: tempPath };
    } catch (err) {
      console.error('[IPC] Error creating blank PDF:', err);
      throw err;
    }
  });

  // --- File Operations ---
  ipcMain.handle(IPC_CHANNELS.FILE_OPEN, async (event, options = {}) => {
    const win = getWindow(event);
    console.log('[IPC] file:open requested', options);

    // If multi selections is requested (e.g. for merging PDFs)
    if (options.multi) {
      const { dialog } = await import('electron');
      const result = await dialog.showOpenDialog(win, {
        title: 'Select Files to Combine',
        filters: [
          { name: 'All Supported Files', extensions: ['pdf', 'docx', 'doc', 'odt', 'txt', 'png', 'jpg', 'jpeg'] },
          { name: 'PDF Files', extensions: ['pdf'] },
          { name: 'Word & Text Documents', extensions: ['docx', 'doc', 'odt', 'txt'] },
          { name: 'Image Files', extensions: ['png', 'jpg', 'jpeg'] }
        ],
        properties: ['openFile', 'multiSelections']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      return result.filePaths;
    }

    // Single file open: open in a new BrowserWindow
    const fileInfo = await openFile(win);
    if (fileInfo && fileInfo.filePath) {
      console.log(`[IPC] Opening selected file in new window: ${fileInfo.filePath}`);
      WindowManager.createDocumentWindow(fileInfo.filePath);
    }
    return null; // Return null so the current window does not load it
  });

  ipcMain.handle('file:read', async (event, filePath) => {
    console.log(`[IPC] file:read requested for path: ${filePath}`);
    try {
      const fs = await import('fs/promises');
      const data = await fs.readFile(filePath);
      // Auto-watch file for this webContents context
      watchFile(filePath, event.sender);
      return new Uint8Array(data);
    } catch (err) {
      console.error(`[IPC] Error reading file by path "${filePath}":`, err);
      throw err;
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_SAVE, async (event, payload) => {
    const { filePath, data, annotations, forms } = payload || {};
    console.log(`[IPC] file:save requested for path: ${filePath}`);
    
    // Temporarily unwatch to prevent trigger change alerts on saving
    unwatchFile(filePath, event.sender);
    
    try {
      if (data) {
        // Raw file binary writing
        const result = await saveFile(filePath, data);
        return result;
      } else {
        // Mock save annotations/forms metadata, return success and clear temp draft
        console.log(`[IPC] Mock saving annotations and forms for: ${filePath}`);
        await clearTempCopy(filePath);
        return { success: true, filePath };
      }
    } catch (err) {
      console.error(`[IPC] Error saving document changes:`, err);
      throw err;
    } finally {
      watchFile(filePath, event.sender);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_SAVE_AS, async (event, payload) => {
    const { data, defaultPath } = payload || {};
    const win = getWindow(event);
    console.log('[IPC] file:save-as requested');
    
    const fileInfo = await saveFileAs(win, data, defaultPath);
    if (fileInfo && fileInfo.filePath) {
      watchFile(fileInfo.filePath, event.sender);
    }
    return fileInfo;
  });

  // --- Printing ---
  ipcMain.handle(IPC_CHANNELS.PRINT_GET_PRINTERS, async (event) => {
    const win = getWindow(event);
    console.log('[IPC] print:get-printers requested');
    return await getPrinters(win);
  });

  ipcMain.handle(IPC_CHANNELS.PRINT_EXECUTE, async (event, options) => {
    const win = getWindow(event);
    console.log('[IPC] print:execute requested', options);
    return await printExecute(win, options);
  });

  ipcMain.handle(IPC_CHANNELS.PRINT_TO_PDF, async (event, options) => {
    const win = getWindow(event);
    console.log('[IPC] print:to-pdf requested', options);
    return await printToPDF(win, options);
  });

  // --- PDF Operations ---
  ipcMain.handle(IPC_CHANNELS.PDF_MERGE, async (event, payload) => {
    const win = getWindow(event);
    const filePaths = Array.isArray(payload) ? payload : payload.files;
    const defaultFileName = (payload && typeof payload === 'object') ? (payload.outputPath || 'merged.pdf') : 'merged.pdf';
    console.log('[IPC] pdf:merge requested for files:', filePaths, 'defaultFileName:', defaultFileName);
    return await mergePDFs(win, filePaths, defaultFileName);
  });

  ipcMain.handle(IPC_CHANNELS.PDF_SPLIT, async (event, payload) => {
    const win = getWindow(event);
    const { filePath, ranges } = payload || {};
    console.log(`[IPC] pdf:split requested for file: ${filePath}`);
    return await splitPDF(win, filePath, ranges);
  });

  ipcMain.handle(IPC_CHANNELS.PDF_COMPRESS, async (event, payload) => {
    const win = getWindow(event);
    const filePath = typeof payload === 'string' ? payload : payload.filePath;
    console.log(`[IPC] pdf:compress requested for file: ${filePath}`);
    return await compressPDF(win, filePath);
  });

  ipcMain.handle(IPC_CHANNELS.PDF_CONVERT_TO_PDF, async (event, payload) => {
    const { filePath, outDir } = typeof payload === 'string' ? { filePath: payload } : payload || {};
    console.log(`[IPC] pdf:convert-to-pdf requested for: ${filePath}`);
    return await convertToPdf(filePath, outDir);
  });

  ipcMain.handle(IPC_CHANNELS.PDF_CONVERT_FROM_PDF, async (event, payload) => {
    const { filePath, targetFormat, outDir } = payload || {};
    console.log(`[IPC] pdf:convert-from-pdf requested for: ${filePath} to format: ${targetFormat}`);
    return await convertFromPdf(filePath, targetFormat, outDir);
  });

  ipcMain.handle('pdf:add-watermark', async (event, payload) => {
    const { filePath, options, outputPath } = payload || {};
    console.log(`[IPC] pdf:add-watermark requested for: ${filePath}`);
    return await addWatermark(filePath, options, outputPath);
  });

  ipcMain.handle('pdf:add-header-footer', async (event, payload) => {
    const { filePath, options, outputPath } = payload || {};
    console.log(`[IPC] pdf:add-header-footer requested for: ${filePath}`);
    return await addHeaderFooter(filePath, options, outputPath);
  });

  ipcMain.handle('pdf:encrypt', async (event, payload) => {
    const { filePath, options } = payload || {};
    console.log(`[IPC] pdf:encrypt requested for: ${filePath}`);
    return await encryptPdf(filePath, options);
  });

  ipcMain.handle('pdf:get-bookmarks', async (event, payload) => {
    const { filePath } = payload || {};
    console.log(`[IPC] pdf:get-bookmarks requested for: ${filePath}`);
    return await getBookmarks(filePath);
  });

  ipcMain.handle('pdf:set-bookmarks', async (event, payload) => {
    const { filePath, bookmarks, outputPath } = payload || {};
    console.log(`[IPC] pdf:set-bookmarks requested for: ${filePath}`);
    return await setBookmarks(filePath, bookmarks, outputPath);
  });

  ipcMain.handle('pdf:redact', async (event, payload) => {
    const { filePath, redactions, outputPath } = payload || {};
    console.log(`[IPC] pdf:redact requested for: ${filePath}`);
    return await applyRedactions(filePath, redactions, outputPath);
  });

  // --- OCR Operations ---
  ipcMain.handle(IPC_CHANNELS.OCR_EXECUTE, async (event, payload) => {
    const { imageBufferOrPath, language } = payload || {};
    console.log('[IPC] ocr:execute requested with language:', language);
    return await executeOCR(imageBufferOrPath, language);
  });

  // --- App Settings & Recent Files ---
  ipcMain.handle(IPC_CHANNELS.APP_RECENT_FILES, async (event, payload, ...args) => {
    let action, data;
    // Normalize payload from renderer (sometimes object, sometimes separate arguments)
    if (payload && typeof payload === 'object' && 'action' in payload) {
      action = payload.action;
      data = payload.data || payload.file || payload.path;
    } else {
      action = payload;
      data = args[0];
    }

    console.log(`[IPC] app:recent-files action="${action}"`);
    
    if (action === 'get') {
      return store.get('recentFiles') || [];
    } else if (action === 'clear') {
      store.set('recentFiles', []);
      return [];
    } else if (action === 'add' && typeof data === 'string') {
      let recent = store.get('recentFiles') || [];
      recent = recent.filter(p => p !== data);
      recent.unshift(data);
      if (recent.length > 10) recent = recent.slice(0, 10);
      store.set('recentFiles', recent);
      return recent;
    } else if (action === 'remove' && typeof data === 'string') {
      let recent = store.get('recentFiles') || [];
      recent = recent.filter(p => p !== data);
      store.set('recentFiles', recent);
      return recent;
    }
    return [];
  });

  ipcMain.handle(IPC_CHANNELS.APP_SETTINGS, async (event, action, data) => {
    let act = action;
    let val = data;
    if (action && typeof action === 'object' && 'action' in action) {
      act = action.action;
      val = action.data;
    }

    console.log(`[IPC] app:settings action="${act}"`);

    if (act === 'get') {
      return val ? store.get(`settings.${val}`) : store.get('settings');
    } else if (act === 'set' && typeof val === 'object') {
      const current = store.get('settings') || {};
      store.set('settings', { ...current, ...val });
      return store.get('settings');
    } else if (act === 'get-theme') {
      return store.get('theme') || 'light';
    } else if (act === 'set-theme' && typeof val === 'string') {
      store.set('theme', val);
      return val;
    }
    return null;
  });

  // --- Window Controls (Handle both send and invoke) ---
  const minimizeHandler = (event) => {
    const win = getWindow(event);
    if (win) {
      console.log(`[IPC] Minimizing window (ID: ${win.id})`);
      win.minimize();
    }
  };
  ipcMain.on(IPC_CHANNELS.APP_MINIMIZE, minimizeHandler);
  ipcMain.handle(IPC_CHANNELS.APP_MINIMIZE, minimizeHandler);

  const maximizeHandler = (event) => {
    const win = getWindow(event);
    if (win) {
      console.log(`[IPC] Toggle maximize window (ID: ${win.id})`);
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  };
  ipcMain.on(IPC_CHANNELS.APP_MAXIMIZE, maximizeHandler);
  ipcMain.handle(IPC_CHANNELS.APP_MAXIMIZE, maximizeHandler);

  const closeHandler = (event) => {
    const win = getWindow(event);
    if (win) {
      console.log(`[IPC] Closing window (ID: ${win.id})`);
      win.close();
    }
  };
  ipcMain.on(IPC_CHANNELS.APP_CLOSE, closeHandler);
  ipcMain.handle(IPC_CHANNELS.APP_CLOSE, closeHandler);

  // --- Custom Draft / Crash Recovery Handlers ---
  ipcMain.handle('file:save-draft', async (event, payload) => {
    const { filePath, data } = payload || {};
    console.log(`[IPC] file:save-draft requested for: ${filePath}`);
    return await saveTempCopy(filePath, data);
  });

  ipcMain.handle('file:clear-draft', async (event, filePath) => {
    console.log(`[IPC] file:clear-draft requested for: ${filePath}`);
    await clearTempCopy(filePath);
    return { success: true };
  });

  ipcMain.handle('file:check-recovery', async () => {
    console.log('[IPC] file:check-recovery requested');
    return await checkRecoveryFiles();
  });

  ipcMain.handle('pdf:apply-security', async (event, payload) => {
    const { filePath, options } = payload || {};
    console.log(`[IPC] pdf:apply-security requested for: ${filePath}`);
    return await encryptPdf(filePath, options);
  });

  ipcMain.handle('app:quit-and-install', async () => {
    const { default: pkg } = await import('electron-updater');
    const autoUpdater = pkg.autoUpdater;
    autoUpdater.quitAndInstall();
  });
}

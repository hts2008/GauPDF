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
  executeOCR
} from './file-manager.js';
import { getPrinters, printExecute, printToPDF } from './print-manager.js';
import store from './store.js';

export function registerIpcHandlers() {
  // Helper to resolve window from event sender
  const getWindow = (event) => {
    return BrowserWindow.fromWebContents(event.sender);
  };

  // --- File Operations ---
  ipcMain.handle(IPC_CHANNELS.FILE_OPEN, async (event) => {
    const win = getWindow(event);
    const fileInfo = await openFile(win);
    if (fileInfo) {
      // Start watching the file for external changes
      watchFile(fileInfo.filePath, event.sender);
    }
    return fileInfo;
  });

  ipcMain.handle(IPC_CHANNELS.FILE_SAVE, async (event, { filePath, data }) => {
    // Temp stop watching during save to avoid triggering change event on ourselves
    unwatchFile(filePath);
    try {
      const result = await saveFile(filePath, data);
      return result;
    } finally {
      watchFile(filePath, event.sender);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FILE_SAVE_AS, async (event, { data, defaultPath }) => {
    const win = getWindow(event);
    const fileInfo = await saveFileAs(win, data, defaultPath);
    if (fileInfo) {
      watchFile(fileInfo.filePath, event.sender);
    }
    return fileInfo;
  });

  // --- Printing ---
  ipcMain.handle(IPC_CHANNELS.PRINT_GET_PRINTERS, async (event) => {
    const win = getWindow(event);
    return await getPrinters(win);
  });

  ipcMain.handle(IPC_CHANNELS.PRINT_EXECUTE, async (event, options) => {
    const win = getWindow(event);
    return await printExecute(win, options);
  });

  ipcMain.handle(IPC_CHANNELS.PRINT_TO_PDF, async (event, options) => {
    const win = getWindow(event);
    return await printToPDF(win, options);
  });

  // --- PDF Operations ---
  ipcMain.handle(IPC_CHANNELS.PDF_MERGE, async (event, filePaths) => {
    const win = getWindow(event);
    return await mergePDFs(win, filePaths);
  });

  ipcMain.handle(IPC_CHANNELS.PDF_SPLIT, async (event, { filePath, ranges }) => {
    const win = getWindow(event);
    return await splitPDF(win, filePath, ranges);
  });

  ipcMain.handle(IPC_CHANNELS.PDF_COMPRESS, async (event, filePath) => {
    const win = getWindow(event);
    return await compressPDF(win, filePath);
  });

  // --- OCR Operations ---
  ipcMain.handle(IPC_CHANNELS.OCR_EXECUTE, async (event, { imageBufferOrPath, language }) => {
    return await executeOCR(imageBufferOrPath, language);
  });

  // --- App Settings & Recent Files ---
  ipcMain.handle(IPC_CHANNELS.APP_RECENT_FILES, async (event, action, data) => {
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
    }
    return [];
  });

  ipcMain.handle(IPC_CHANNELS.APP_SETTINGS, async (event, action, data) => {
    if (action === 'get') {
      // data is settings key, or undefined for all settings
      return data ? store.get(`settings.${data}`) : store.get('settings');
    } else if (action === 'set' && typeof data === 'object') {
      const current = store.get('settings') || {};
      store.set('settings', { ...current, ...data });
      return store.get('settings');
    } else if (action === 'get-theme') {
      return store.get('theme') || 'light';
    } else if (action === 'set-theme' && typeof data === 'string') {
      store.set('theme', data);
      return data;
    }
    return null;
  });

  // --- Window Controls ---
  ipcMain.handle(IPC_CHANNELS.APP_MINIMIZE, (event) => {
    const win = getWindow(event);
    if (win) win.minimize();
  });

  ipcMain.handle(IPC_CHANNELS.APP_MAXIMIZE, (event) => {
    const win = getWindow(event);
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.handle(IPC_CHANNELS.APP_CLOSE, (event) => {
    const win = getWindow(event);
    if (win) win.close();
  });

  // --- Custom Draft / Crash Recovery Handlers ---
  ipcMain.handle('file:save-draft', async (event, { filePath, data }) => {
    return await saveTempCopy(filePath, data);
  });

  ipcMain.handle('file:clear-draft', async (event, filePath) => {
    await clearTempCopy(filePath);
    return { success: true };
  });

  ipcMain.handle('file:check-recovery', async () => {
    return await checkRecoveryFiles();
  });
}

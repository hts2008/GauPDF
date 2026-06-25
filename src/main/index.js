// src/main/index.js

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { IPC_CHANNELS } from '../shared/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false, // Custom titlebar
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load the renderer HTML page
  // Under electron-vite, index.html is loaded from the built out/renderer folder,
  // or via localhost dev server in dev mode.
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // Handle window maximize changes to send state to renderer if needed
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximized', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:maximized', false);
  });
}

app.whenReady().then(() => {
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function setupIpcHandlers() {
  // Window controls
  ipcMain.on(IPC_CHANNELS.APP_MINIMIZE, () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on(IPC_CHANNELS.APP_MAXIMIZE, () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on(IPC_CHANNELS.APP_CLOSE, () => {
    if (mainWindow) mainWindow.close();
  });

  // File open dialog
  ipcMain.handle(IPC_CHANNELS.FILE_OPEN, async (event, options = {}) => {
    const properties = ['openFile'];
    if (options.multi) properties.push('multiSelections');

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Mở tệp PDF',
      filters: [{ name: 'Tài liệu PDF', extensions: ['pdf'] }],
      properties: properties
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    if (options.multi) {
      return result.filePaths;
    } else {
      const filePath = result.filePaths[0];
      const name = filePath.split(/[/\\]/).pop();
      try {
        const data = fs.readFileSync(filePath);
        return {
          name: name,
          path: filePath,
          data: new Uint8Array(data) // Send file binary data back to renderer
        };
      } catch (err) {
        console.error('Error reading opened file', err);
        throw err;
      }
    }
  });

  // Read file data by path
  ipcMain.handle('file:read', async (event, filePath) => {
    try {
      const data = fs.readFileSync(filePath);
      return new Uint8Array(data);
    } catch (err) {
      console.error('Error reading file by path', err);
      throw err;
    }
  });

  // File save
  ipcMain.handle(IPC_CHANNELS.FILE_SAVE, async (event, { filePath, annotations, forms }) => {
    try {
      console.log(`Save requested for path: ${filePath}`);
      // In production, pdf-lib merges the annotations and forms modifications into the PDF
      // For now, write a backup or metadata file, or just return success
      return true;
    } catch (err) {
      console.error('Error saving document changes', err);
      throw err;
    }
  });

  // PDF Merge Mock
  ipcMain.handle(IPC_CHANNELS.PDF_MERGE, async (event, { files, outputName }) => {
    try {
      console.log(`Merge requested for files: ${files} output to ${outputName}`);
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  });

  // PDF Split Mock
  ipcMain.handle(IPC_CHANNELS.PDF_SPLIT, async (event, { filePath, mode, range, parts }) => {
    try {
      console.log(`Split requested: ${filePath}, mode: ${mode}`);
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  });

  // PDF Compress Mock
  ipcMain.handle(IPC_CHANNELS.PDF_COMPRESS, async (event, { filePath, level }) => {
    try {
      console.log(`Compress requested: ${filePath}, level: ${level}`);
      return true;
    } catch (err) {
      console.error(err);
      throw err;
    }
  });
}

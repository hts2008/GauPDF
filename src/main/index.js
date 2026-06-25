// src/main/index.js
import { app, ipcMain } from 'electron';
import path from 'path';
import WindowManager from './window-manager.js';
import { registerIpcHandlers } from './ipc-handlers.js';

// Setup single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('[Main] Another instance is already running. Quitting.');
  app.quit();
} else {
  // Store files to open on macOS before app is ready
  const macFilesQueue = [];

  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('[Main] Second instance detected with commandLine:', commandLine);
    
    // Parse paths from second instance command line
    const pdfPaths = getPdfPathsFromArgv(commandLine);
    if (pdfPaths.length > 0) {
      pdfPaths.forEach(filePath => {
        WindowManager.createDocumentWindow(filePath);
      });
    } else {
      // Just focus the active window
      const activeWin = WindowManager.getActiveWindow();
      if (activeWin) {
        if (activeWin.isMinimized()) activeWin.restore();
        activeWin.focus();
      }
    }
  });

  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    console.log('[Main] open-file event triggered for path:', filePath);
    
    if (app.isReady()) {
      WindowManager.createDocumentWindow(filePath);
    } else {
      macFilesQueue.push(filePath);
    }
  });

  app.whenReady().then(() => {
    console.log('[Main] Electron Application is ready');
    
    // Register all IPC events and handlers
    registerIpcHandlers();

    // Check files queue from macOS open-file event
    if (macFilesQueue.length > 0) {
      macFilesQueue.forEach(filePath => {
        WindowManager.createDocumentWindow(filePath);
      });
    } else {
      // Parse CLI arguments for Windows/Linux
      const pdfPaths = getPdfPathsFromArgv(process.argv);
      if (pdfPaths.length > 0) {
        pdfPaths.forEach(filePath => {
          WindowManager.createDocumentWindow(filePath);
        });
      } else {
        WindowManager.createWelcomeWindow();
      }
    }

    app.on('activate', () => {
      if (WindowManager.getWindowCount() === 0) {
        WindowManager.createWelcomeWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      console.log('[Main] All windows closed. Quitting.');
      app.quit();
    }
  });
}

/**
 * Utility to extract valid PDF file paths from command-line arguments.
 * Handles differences between development and packaged production environments.
 */
function getPdfPathsFromArgv(argv) {
  const pdfPaths = [];
  // Skip execution paths. Electron has process.defaultApp true in dev mode.
  const isDev = process.defaultApp || /node_modules[\\/]electron[\\/]/.test(process.execPath);
  const startIndex = isDev ? 2 : 1;

  for (let i = startIndex; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--') || arg.startsWith('-')) {
      continue;
    }
    if (arg.toLowerCase().endsWith('.pdf')) {
      try {
        const fullPath = path.resolve(arg);
        pdfPaths.push(fullPath);
      } catch (err) {
        console.error(`[Main] Error resolving path "${arg}":`, err);
      }
    }
  }
  return pdfPaths;
}

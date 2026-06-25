import { BrowserWindow, app } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { buildMenu } from './menu-builder.js';
import { addToRecentFiles } from './file-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

let preloadPath = join(__dirname, '../preload/index.js');
if (!fs.existsSync(preloadPath)) {
  preloadPath = join(__dirname, '../preload/index.mjs');
}

class WindowManager {
  constructor() {
    // Registry of active windows
    // Map of windowId -> { type: 'welcome'|'document', filePath?: string, window: BrowserWindow }
    this.windows = new Map();
  }

  createWelcomeWindow() {
    console.log('[WindowManager] Creating Welcome Window');
    
    // Focus existing Welcome Window if already open
    for (const winInfo of this.windows.values()) {
      if (winInfo.type === 'welcome') {
        if (!winInfo.window.isDestroyed()) {
          if (winInfo.window.isMinimized()) winInfo.window.restore();
          winInfo.window.focus();
          return winInfo.window;
        }
      }
    }

    const win = new BrowserWindow({
      width: 1020,
      height: 700,
      minWidth: 800,
      minHeight: 600,
      frame: false, // Custom window titlebar
      show: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        additionalArguments: ['--window-type=welcome']
      }
    });

    this.windows.set(win.id, { type: 'welcome', window: win });

    if (process.env.ELECTRON_RENDERER_URL) {
      win.loadURL(process.env.ELECTRON_RENDERER_URL);
    } else {
      win.loadFile(join(__dirname, '../renderer/index.html'));
    }

    win.once('ready-to-show', () => {
      console.log('[WindowManager] Welcome Window is ready to show');
      win.show();
    });

    win.on('closed', () => {
      console.log(`[WindowManager] Welcome Window (ID: ${win.id}) closed`);
      this.windows.delete(win.id);
      this.checkAppLifecycle();
    });

    buildMenu(win);

    return win;
  }

  createDocumentWindow(filePath, isNew = false) {
    console.log(`[WindowManager] Creating Document Window for file: ${filePath}, isNew: ${isNew}`);
    
    // Focus existing window for this file if already open
    for (const winInfo of this.windows.values()) {
      if (winInfo.type === 'document' && winInfo.filePath === filePath) {
        if (!winInfo.window.isDestroyed()) {
          if (winInfo.window.isMinimized()) winInfo.window.restore();
          winInfo.window.focus();
          return winInfo.window;
        }
      }
    }

    // Add to recent files if not a temporary new blank document
    if (!isNew) {
      try {
        addToRecentFiles(filePath);
      } catch (err) {
        console.error('[WindowManager] Failed to add file to recents:', err);
      }
    }

    const win = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      frame: false, // Custom window titlebar
      show: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        additionalArguments: [
          '--window-type=document',
          `--file-path=${filePath}`,
          `--is-new=${isNew}`
        ]
      }
    });

    this.windows.set(win.id, { type: 'document', filePath, window: win });

    const queryStr = `?mode=document&filePath=${encodeURIComponent(filePath)}`;
    if (process.env.ELECTRON_RENDERER_URL) {
      win.loadURL(process.env.ELECTRON_RENDERER_URL + queryStr);
    } else {
      win.loadFile(join(__dirname, '../renderer/index.html'), {
        query: { mode: 'document', filePath }
      });
    }

    win.once('ready-to-show', () => {
      console.log(`[WindowManager] Document Window (ID: ${win.id}) is ready to show`);
      win.show();
      // Auto close Welcome Window when a document window opens
      this.closeWelcomeWindows();
    });

    win.on('maximize', () => {
      if (!win.isDestroyed()) {
        win.webContents.send('window:maximized', true);
      }
    });
    win.on('unmaximize', () => {
      if (!win.isDestroyed()) {
        win.webContents.send('window:maximized', false);
      }
    });

    win.on('closed', () => {
      console.log(`[WindowManager] Document Window (ID: ${win.id}) closed`);
      this.windows.delete(win.id);
      
      // Clean up file watchers for this window
      import('./file-manager.js')
        .then(({ clearWatchersForWindow }) => {
          clearWatchersForWindow(win.webContents);
        })
        .catch(err => console.error('[WindowManager] Failed to clear file watchers on window close:', err));

      // Re-create Welcome Window if no documents are left open
      if (this.getDocumentWindowCount() === 0) {
        this.createWelcomeWindow();
      }
    });

    buildMenu(win);

    return win;
  }

  closeWelcomeWindows() {
    for (const [id, winInfo] of this.windows.entries()) {
      if (winInfo.type === 'welcome') {
        if (!winInfo.window.isDestroyed()) {
          console.log(`[WindowManager] Closing Welcome Window (ID: ${id}) because a document window is active`);
          winInfo.window.close();
        }
      }
    }
  }

  checkAppLifecycle() {
    const docWindowsCount = this.getDocumentWindowCount();
    const welcomeWindowsCount = Array.from(this.windows.values()).filter(w => w.type === 'welcome').length;
    
    if (docWindowsCount === 0 && welcomeWindowsCount === 0) {
      if (process.platform === 'darwin') {
        this.createWelcomeWindow();
      } else {
        console.log('[WindowManager] No active windows remaining, quitting app');
        app.quit();
      }
    }
  }

  getActiveWindow() {
    const focused = BrowserWindow.getFocusedWindow();
    if (focused) return focused;
    if (this.windows.size > 0) {
      return this.windows.values().next().value.window;
    }
    return null;
  }

  getWindowCount() {
    return this.windows.size;
  }

  getDocumentWindowCount() {
    return Array.from(this.windows.values()).filter(w => w.type === 'document').length;
  }
}

const windowManager = new WindowManager();
export default windowManager;

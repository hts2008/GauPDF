// src/main/updater.js
import { autoUpdater } from 'electron-updater';
import { BrowserWindow, app } from 'electron';

/**
 * Configure and initialize the application auto-updater.
 * Listens to update availability and download progress, forwarding these events
 * to all open application windows, and triggers the initial check if packaged.
 */
export function setupAutoUpdater() {
  // Configure logger for auto-updater
  autoUpdater.logger = console;

  console.log('[Updater] Initializing auto-updater service');

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Checking for update...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Update available:', info);
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('app:update-available', info);
      }
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[Updater] Update not available:', info);
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error in auto-updater:', err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    console.log(`[Updater] Download progress: ${progressObj.percent}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Updater] Update downloaded:', info);
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('app:update-downloaded', info);
      }
    });
  });

  // Only run updater if the app is packaged/production
  if (app.isPackaged) {
    try {
      autoUpdater.checkForUpdatesAndNotify();
    } catch (err) {
      console.warn('[Updater] Error checking for updates:', err);
    }
  } else {
    console.log('[Updater] App is not packaged. Skipping update check.');
  }
}

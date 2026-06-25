// src/main/menu-builder.js
import { Menu, app } from 'electron';
import { openFile } from './file-manager.js';

export function buildMenu(browserWindow) {
  const isMac = process.platform === 'darwin';

  const template = [
    // App Menu (macOS only)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    // File Menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Open PDF...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const fileInfo = await openFile(browserWindow);
            if (fileInfo) {
              browserWindow.webContents.send('menu-action', { action: 'open', data: fileInfo });
            }
          }
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            browserWindow.webContents.send('menu-action', { action: 'save' });
          }
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            browserWindow.webContents.send('menu-action', { action: 'save-as' });
          }
        },
        { type: 'separator' },
        {
          label: 'Print...',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            browserWindow.webContents.send('menu-action', { action: 'print' });
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    // Edit Menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    // View Menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            browserWindow.webContents.send('menu-action', { action: 'zoom-in' });
          }
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            browserWindow.webContents.send('menu-action', { action: 'zoom-out' });
          }
        },
        {
          label: 'Actual Size',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            browserWindow.webContents.send('menu-action', { action: 'zoom-reset' });
          }
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        {
          label: 'Toggle Developer Tools',
          accelerator: isMac ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click: () => {
            browserWindow.webContents.toggleDevTools();
          }
        }
      ]
    },
    // Help Menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = await import('electron');
            await shell.openExternal('https://github.com/hts2008/GauPDF');
          }
        },
        { type: 'separator' },
        {
          label: 'About GauPDF',
          click: async () => {
            const { dialog } = await import('electron');
            dialog.showMessageBox(browserWindow, {
              title: 'About GauPDF',
              type: 'info',
              message: 'GauPDF Editor',
              detail: 'Version: 1.0.0\nSecure and powerful local PDF editing, splitting, merging, compressing, and OCR processing.',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// src/preload/index.js
const { contextBridge, ipcRenderer } = require('electron');

// Extract additionalArguments passed from the main process
const args = process.argv || [];
const windowTypeArg = args.find(arg => arg.startsWith('--window-type='));
const filePathArg = args.find(arg => arg.startsWith('--file-path='));

const windowConfig = {
  mode: windowTypeArg ? windowTypeArg.split('=')[1] : 'welcome',
  filePath: filePathArg ? filePathArg.split('=')[1] : null
};

console.log('[Preload] Exposing API with window config:', windowConfig);

// Expose protected APIs to the renderer process
contextBridge.exposeInMainWorld('api', {
  // Window Configuration
  getWindowConfig: () => windowConfig,

  // Multi-window operations
  openFileInNewWindow: (filePath) => ipcRenderer.invoke('app:open-file-window', filePath),

  // LibreOffice document conversion and styling
  convertToPdf: (payload) => ipcRenderer.invoke('pdf:convert-to-pdf', payload),
  convertFromPdf: (payload) => ipcRenderer.invoke('pdf:convert-from-pdf', payload),
  addWatermark: (payload) => ipcRenderer.invoke('pdf:add-watermark', payload),
  addHeaderFooter: (payload) => ipcRenderer.invoke('pdf:add-header-footer', payload),

  // Phase 3 Features (Encryption, Bookmarks, Redactions)
  encryptPdf: (payload) => ipcRenderer.invoke('pdf:encrypt', payload),
  getBookmarks: (payload) => ipcRenderer.invoke('pdf:get-bookmarks', payload),
  setBookmarks: (payload) => ipcRenderer.invoke('pdf:set-bookmarks', payload),
  applyRedactions: (payload) => ipcRenderer.invoke('pdf:redact', payload),

  // Basic IPC utilities (highly compatible with old renderer code)
  send: (channel, ...args) => {
    ipcRenderer.send(channel, ...args);
  },
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(event, ...args));
  },
  invoke: async (channel, ...args) => {
    return await ipcRenderer.invoke(channel, ...args);
  },
  on: (channel, func) => {
    const subscription = (event, ...args) => func(event, ...args);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  }
});

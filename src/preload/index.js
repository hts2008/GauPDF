// src/preload/index.js

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected APIs to the renderer process
contextBridge.exposeInMainWorld('api', {
  send: (channel, ...args) => {
    // Whitelist channels
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

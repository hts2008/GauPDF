// src/main/store.js
import Store from 'electron-store';

const schema = {
  theme: {
    type: 'string',
    enum: ['light', 'dark'],
    default: 'light'
  },
  recentFiles: {
    type: 'array',
    items: {
      type: 'string'
    },
    default: []
  },
  settings: {
    type: 'object',
    properties: {
      autoSave: { type: 'boolean', default: true },
      autoSaveInterval: { type: 'number', default: 300000 }, // 5 minutes in ms
      defaultPrinter: { type: 'string', default: '' },
      language: { type: 'string', default: 'en' }
    },
    default: {}
  }
};

const store = new Store({ schema });

export default store;

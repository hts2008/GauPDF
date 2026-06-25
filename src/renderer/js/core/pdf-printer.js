// src/renderer/js/core/pdf-printer.js
import { IPC_CHANNELS } from '../../../shared/constants.js';

// Resolve the ipcRenderer from potential preload configurations
const ipcRenderer = window.electron?.ipcRenderer || window.api?.ipcRenderer || window.ipcRenderer;

export class PDFPrinter {
  /**
   * Check if the printing APIs are available in this renderer context
   * @returns {boolean}
   */
  static isAvailable() {
    return typeof ipcRenderer !== 'undefined';
  }

  /**
   * Get list of system printers from the main process
   * @returns {Promise<Array<{name: string, displayName: string, isDefault: boolean, status: number}>>}
   */
  static async getPrinters() {
    if (!this.isAvailable()) {
      throw new Error('PDFPrinter: Electron IPC APIs are not available in this context');
    }
    try {
      return await ipcRenderer.invoke(IPC_CHANNELS.PRINT_GET_PRINTERS);
    } catch (error) {
      console.error('PDFPrinter: Failed to fetch printers:', error);
      throw error;
    }
  }

  /**
   * Execute PDF printing via Electron main process print API
   * 
   * @param {string|ArrayBuffer} pdfSource File path (string) or raw PDF bytes (ArrayBuffer/Uint8Array)
   * @param {Object} options Print configuration options
   * @param {string} [options.printerName] Target printer name (default: default system printer)
   * @param {boolean} [options.silent] Whether to skip the print dialog window (default: false)
   * @param {boolean} [options.printBackground] Print background graphics (default: true)
   * @param {number} [options.copies] Number of copies to print (default: 1)
   * @param {string} [options.pageRange] Print page ranges, e.g. "1-3, 5" (default: all pages)
   * @param {string} [options.pageSize] Page size (A3, A4, A5, Legal, Letter, Tabloid, default: A4)
   * @param {'simplex'|'duplex'|'duplexShort'|'duplexLong'} [options.duplexMode] Duplex mode (default: 'simplex')
   * @param {boolean} [options.color] Print in color or grayscale (default: true)
   * @param {'portrait'|'landscape'} [options.orientation] Orientation (default: 'portrait')
   * @returns {Promise<boolean>} Success status of print execution
   */
  static async print(pdfSource, options = {}) {
    if (!this.isAvailable()) {
      throw new Error('PDFPrinter: Electron IPC APIs are not available in this context');
    }

    // Normalize settings
    const printOptions = {
      printerName: options.printerName || '',
      silent: !!options.silent,
      printBackground: options.printBackground !== false,
      copies: options.copies || 1,
      pageRange: options.pageRange || 'all',
      pageSize: options.pageSize || 'A4',
      duplexMode: options.duplexMode || 'simplex',
      color: options.color !== false,
      landscape: options.orientation === 'landscape'
    };

    let targetSource = pdfSource;
    
    // If pdfSource is ArrayBuffer, we must convert it or pass it as a buffer.
    // In Electron IPC, ArrayBuffer can be serialized automatically. But passing a Uint8Array is often more robust.
    if (pdfSource instanceof ArrayBuffer) {
      targetSource = new Uint8Array(pdfSource);
    }

    try {
      return await ipcRenderer.invoke(IPC_CHANNELS.PRINT_EXECUTE, {
        source: targetSource,
        options: printOptions
      });
    } catch (error) {
      console.error('PDFPrinter: Printing execution failed:', error);
      throw error;
    }
  }

  /**
   * Save/Export print settings to local store (or settings channel)
   * @param {Object} settings Print options to cache
   */
  static async saveDefaultSettings(settings) {
    if (!this.isAvailable()) return;
    try {
      await ipcRenderer.invoke(IPC_CHANNELS.APP_SETTINGS, {
        key: 'defaultPrintSettings',
        value: settings
      });
    } catch (error) {
      console.error('PDFPrinter: Failed to save default print settings:', error);
    }
  }

  /**
   * Retrieve cached print settings
   * @returns {Promise<Object|null>} Cached options
   */
  static async getDefaultSettings() {
    if (!this.isAvailable()) return null;
    try {
      return await ipcRenderer.invoke(IPC_CHANNELS.APP_SETTINGS, {
        key: 'defaultPrintSettings'
      });
    } catch (error) {
      console.error('PDFPrinter: Failed to get default print settings:', error);
      return null;
    }
  }
}

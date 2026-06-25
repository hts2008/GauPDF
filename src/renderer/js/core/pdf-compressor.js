// src/renderer/js/core/pdf-compressor.js
import { PDFDocument } from 'pdf-lib';
import { IPC_CHANNELS } from '../../../shared/constants.js';
import { fileToArrayBuffer } from '../utils/file-utils.js';

const ipcRenderer = window.electron?.ipcRenderer || window.api?.ipcRenderer || window.ipcRenderer;

export class PDFCompressor {
  /**
   * Compress/Optimize PDF document size.
   * Runs the main-process optimizer via IPC if available, 
   * otherwise falls back to client-side structural optimization using pdf-lib.
   * 
   * @param {File|ArrayBuffer|Uint8Array} pdfSource The source PDF file
   * @param {Object} options Compression configurations
   * @param {'low'|'medium'|'high'} [options.level] Compression quality/level (default: 'medium')
   * @returns {Promise<ArrayBuffer>} The optimized PDF ArrayBuffer
   */
  static async compress(pdfSource, options = {}) {
    const compressionLevel = options.level || 'medium'; // low, medium, high

    let pdfBytes = pdfSource;
    if (pdfSource instanceof File) {
      pdfBytes = await fileToArrayBuffer(pdfSource);
    } else if (pdfSource instanceof Uint8Array) {
      pdfBytes = pdfBytes.buffer;
    }

    if (!(pdfBytes instanceof ArrayBuffer)) {
      throw new Error('PDFCompressor: Invalid PDF source');
    }

    // 1. Try Main Process IPC Compression first (preferred for better image downsampling/optimizations)
    if (typeof ipcRenderer !== 'undefined') {
      try {
        const payloadBytes = new Uint8Array(pdfBytes);
        const resultBytes = await ipcRenderer.invoke(IPC_CHANNELS.PDF_COMPRESS, {
          data: payloadBytes,
          level: compressionLevel
        });
        
        if (resultBytes && (resultBytes instanceof Uint8Array || resultBytes instanceof ArrayBuffer)) {
          return resultBytes instanceof Uint8Array ? resultBytes.buffer : resultBytes;
        }
      } catch (ipcError) {
        console.warn('PDFCompressor: IPC-based compression failed, falling back to local optimization:', ipcError);
      }
    }

    // 2. Fallback to client-side optimization using pdf-lib (Object Streams compression)
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      // pdf-lib optimization settings:
      // useObjectStreams: true collapses structural elements into object streams, saving space.
      const compressedBytes = await pdfDoc.save({
        useObjectStreams: true,
        addGlossaryMap: false,
        updateMetadata: false
      });

      return compressedBytes.buffer;
    } catch (localError) {
      console.error('PDFCompressor: Client-side compression failed:', localError);
      throw localError;
    }
  }
}

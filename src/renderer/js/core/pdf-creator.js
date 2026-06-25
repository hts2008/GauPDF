// src/renderer/js/core/pdf-creator.js
import { PDFDocument } from 'pdf-lib';
import { jsPDF } from 'jspdf';
import { fileToArrayBuffer } from '../utils/file-utils.js';

/**
 * Standard paper sizes in points (pt)
 */
export const PAPER_SIZES = {
  A4: [595.28, 841.89],
  Letter: [612.0, 792.0],
  Legal: [612.0, 1008.0],
  A3: [841.89, 1190.55]
};

/**
 * Create a new blank PDF document
 * @param {Object} options Configuration parameters
 * @param {number} [options.pagesCount] Number of blank pages to add (default: 1)
 * @param {string|number[]} [options.size] Size of pages ('A4', 'Letter', etc. or [width, height] in points, default: 'A4')
 * @param {'portrait'|'landscape'} [options.orientation] Orientation (default: 'portrait')
 * @returns {Promise<ArrayBuffer>} The created PDF bytes as ArrayBuffer
 */
export async function createBlankPDF(options = {}) {
  const pagesCount = options.pagesCount || 1;
  const orientation = options.orientation || 'portrait';
  
  let pageSize = PAPER_SIZES.A4;
  if (typeof options.size === 'string' && PAPER_SIZES[options.size]) {
    pageSize = PAPER_SIZES[options.size];
  } else if (Array.isArray(options.size) && options.size.length === 2) {
    pageSize = options.size;
  }

  // Adjust dimensions based on orientation
  let [width, height] = pageSize;
  if (orientation === 'landscape') {
    [width, height] = [height, width];
  }

  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < pagesCount; i++) {
    pdfDoc.addPage([width, height]);
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes.buffer;
}

/**
 * Convert a list of image files or binary images to a combined PDF document
 * @param {File[]|ArrayBuffer[]|string[]} images List of Image Files, ArrayBuffers, or Base64/DataURL strings
 * @param {Object} options Layout configurations
 * @param {'original'|'A4'|'Letter'} [options.pageSize] Size of PDF pages (default: 'original')
 * @param {'portrait'|'landscape'} [options.orientation] Page orientation (default: 'portrait')
 * @param {number} [options.margin] Page margin in points (default: 0)
 * @param {boolean} [options.fitToPage] Scale image to fit the page size (default: true)
 * @returns {Promise<ArrayBuffer>} The output PDF as ArrayBuffer
 */
export async function imagesToPDF(images, options = {}) {
  const pageSizeType = options.pageSize || 'original';
  const orientation = options.orientation || 'portrait';
  const margin = typeof options.margin === 'number' ? options.margin : 0;
  const fitToPage = options.fitToPage !== false;

  const pdfDoc = await PDFDocument.create();

  for (const imgSource of images) {
    let imageBytes = null;
    let mimeType = '';

    // Convert source to ArrayBuffer and detect type
    if (imgSource instanceof File) {
      mimeType = imgSource.type;
      imageBytes = await fileToArrayBuffer(imgSource);
    } else if (imgSource instanceof ArrayBuffer) {
      imageBytes = imgSource;
    } else if (typeof imgSource === 'string') {
      // Handle Base64 or DataURL strings
      if (imgSource.startsWith('data:')) {
        const parts = imgSource.split(',');
        mimeType = parts[0].split(';')[0].split(':')[1];
        const base64 = parts[1];
        imageBytes = _base64ToArrayBuffer(base64);
      } else {
        // Assume raw Base64 string
        imageBytes = _base64ToArrayBuffer(imgSource);
      }
    }

    if (!imageBytes) continue;

    // Detect image type signature if MIME type is missing
    if (!mimeType) {
      const bytes = new Uint8Array(imageBytes);
      if (bytes[0] === 0xff && bytes[1] === 0xd8) {
        mimeType = 'image/jpeg';
      } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
        mimeType = 'image/png';
      } else {
        throw new Error('Unsupported image format. Only JPEG and PNG are supported by pdf-lib.');
      }
    }

    // Embed the image
    let pdfImage;
    if (mimeType === 'image/png') {
      pdfImage = await pdfDoc.embedPng(imageBytes);
    } else {
      // Default to JPEG
      pdfImage = await pdfDoc.embedJpg(imageBytes);
    }

    // Calculate dimensions
    const imgWidth = pdfImage.width;
    const imgHeight = pdfImage.height;

    let pageWidth, pageHeight;

    if (pageSizeType === 'original') {
      pageWidth = imgWidth + margin * 2;
      pageHeight = imgHeight + margin * 2;
    } else {
      const sizeDef = PAPER_SIZES[pageSizeType] || PAPER_SIZES.A4;
      [pageWidth, pageHeight] = sizeDef;
      if (orientation === 'landscape') {
        [pageWidth, pageHeight] = [pageHeight, pageWidth];
      }
    }

    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Calculate scaling to draw image on the page
    let drawWidth = imgWidth;
    let drawHeight = imgHeight;
    let drawX = margin;
    let drawY = margin;

    const maxDrawWidth = pageWidth - margin * 2;
    const maxDrawHeight = pageHeight - margin * 2;

    if (fitToPage && (imgWidth > maxDrawWidth || imgHeight > maxDrawHeight || pageSizeType !== 'original')) {
      const scaleX = maxDrawWidth / imgWidth;
      const scaleY = maxDrawHeight / imgHeight;
      const scale = Math.min(scaleX, scaleY);

      drawWidth = imgWidth * scale;
      drawHeight = imgHeight * scale;

      // Center the scaled image within margins
      drawX = margin + (maxDrawWidth - drawWidth) / 2;
      drawY = margin + (maxDrawHeight - drawHeight) / 2;
    }

    page.drawImage(pdfImage, {
      x: drawX,
      y: drawY,
      width: drawWidth,
      height: drawHeight
    });
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes.buffer;
}

/**
 * Utility helper to convert Base64 string to ArrayBuffer internally
 */
function _base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

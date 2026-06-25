// src/renderer/js/core/pdf-exporter.js
import * as pdfjsLib from 'pdfjs-dist';
import { fileToArrayBuffer } from '../utils/file-utils.js';

// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Export a specific PDF page to an image.
 * 
 * @param {File|ArrayBuffer|Uint8Array} pdfSource The source PDF file
 * @param {number} pageNumber The 1-indexed page number to export
 * @param {Object} options Export options
 * @param {number} [options.scale] Resolution scaling factor (default: 2.0 for high quality)
 * @param {'image/png'|'image/jpeg'|'image/webp'} [options.format] Image MIME format (default: 'image/png')
 * @param {number} [options.quality] Image quality for jpeg/webp between 0 and 1 (default: 0.95)
 * @param {'dataurl'|'blob'} [options.returnType] Return format ('dataurl' or 'blob', default: 'dataurl')
 * @returns {Promise<string|Blob>} Data URL string or Blob representing the image
 */
export async function exportPageToImage(pdfSource, pageNumber, options = {}) {
  const scale = options.scale || 2.0;
  const format = options.format || 'image/png';
  const quality = typeof options.quality === 'number' ? options.quality : 0.95;
  const returnType = options.returnType || 'dataurl';

  let pdfBytes = pdfSource;
  if (pdfSource instanceof File) {
    pdfBytes = await fileToArrayBuffer(pdfSource);
  } else if (pdfSource instanceof Uint8Array) {
    pdfBytes = pdfSource.buffer;
  }

  if (!(pdfBytes instanceof ArrayBuffer)) {
    throw new Error('PDFExporter: Invalid PDF source');
  }

  // Load PDF document
  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes,
    cMapUrl: 'node_modules/pdfjs-dist/cmaps/',
    cMapPacked: true,
  });
  const pdfDoc = await loadingTask.promise;

  if (pageNumber < 1 || pageNumber > pdfDoc.numPages) {
    throw new Error(`PDFExporter: Page number ${pageNumber} out of range (1-${pdfDoc.numPages})`);
  }

  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  // Create offline canvas for rendering
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const renderContext = {
    canvasContext: context,
    viewport: viewport
  };

  await page.render(renderContext).promise;

  if (returnType === 'blob') {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('PDFExporter: Canvas-to-Blob conversion failed'));
      }, format, quality);
    });
  } else {
    // Return data URL
    return canvas.toDataURL(format, quality);
  }
}

/**
 * Export all pages of a PDF document to a list of images.
 * 
 * @param {File|ArrayBuffer|Uint8Array} pdfSource The source PDF file
 * @param {Object} options Export options (same as exportPageToImage)
 * @returns {Promise<Array<{pageNumber: number, image: string|Blob}>>} Array of export items
 */
export async function exportAllPagesToImages(pdfSource, options = {}) {
  let pdfBytes = pdfSource;
  if (pdfSource instanceof File) {
    pdfBytes = await fileToArrayBuffer(pdfSource);
  } else if (pdfSource instanceof Uint8Array) {
    pdfBytes = pdfSource.buffer;
  }

  if (!(pdfBytes instanceof ArrayBuffer)) {
    throw new Error('PDFExporter: Invalid PDF source');
  }

  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes,
    cMapUrl: 'node_modules/pdfjs-dist/cmaps/',
    cMapPacked: true,
  });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  const results = [];
  for (let i = 1; i <= numPages; i++) {
    const image = await exportPageToImage(pdfBytes, i, options);
    results.push({
      pageNumber: i,
      image
    });
  }

  return results;
}

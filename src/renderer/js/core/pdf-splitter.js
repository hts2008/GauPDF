// src/renderer/js/core/pdf-splitter.js
import { PDFDocument } from 'pdf-lib';
import { fileToArrayBuffer } from '../utils/file-utils.js';
import { parsePageRange } from './pdf-merger.js';

/**
 * Extract specific pages from a PDF and save them as a new PDF document.
 * @param {File|ArrayBuffer|Uint8Array} pdfSource The source PDF file
 * @param {string|number[]} pageRange The pages to extract (e.g., "1-3, 5", "2, 4-7")
 * @returns {Promise<ArrayBuffer>} The extracted PDF as ArrayBuffer
 */
export async function extractPages(pdfSource, pageRange) {
  let pdfBytes = pdfSource;
  if (pdfSource instanceof File) {
    pdfBytes = await fileToArrayBuffer(pdfSource);
  } else if (pdfSource instanceof Uint8Array) {
    pdfBytes = pdfSource.buffer;
  }

  if (!(pdfBytes instanceof ArrayBuffer)) {
    throw new Error('PDFSplitter: Invalid PDF source');
  }

  const srcDoc = await PDFDocument.load(pdfBytes);
  const totalPages = srcDoc.getPageCount();
  
  const indices = parsePageRange(pageRange, totalPages);
  if (indices.length === 0) {
    throw new Error('PDFSplitter: No valid pages selected for extraction');
  }

  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(srcDoc, indices);
  copiedPages.forEach(page => {
    newDoc.addPage(page);
  });

  const newBytes = await newDoc.save();
  return newBytes.buffer;
}

/**
 * Split a PDF document into multiple sub-PDF documents at specific page boundaries.
 * 
 * Example: A 10-page document split with points [3, 7] will yield:
 * - File 1: pages 1 to 3
 * - File 2: pages 4 to 7
 * - File 3: pages 8 to 10
 * 
 * @param {File|ArrayBuffer|Uint8Array} pdfSource The source PDF file
 * @param {number[]} splitPoints 1-indexed page numbers representing the end of each sub-document
 * @returns {Promise<ArrayBuffer[]>} An array of output PDF bytes (ArrayBuffers)
 */
export async function splitPDF(pdfSource, splitPoints) {
  let pdfBytes = pdfSource;
  if (pdfSource instanceof File) {
    pdfBytes = await fileToArrayBuffer(pdfSource);
  } else if (pdfSource instanceof Uint8Array) {
    pdfBytes = pdfSource.buffer;
  }

  if (!(pdfBytes instanceof ArrayBuffer)) {
    throw new Error('PDFSplitter: Invalid PDF source');
  }

  const srcDoc = await PDFDocument.load(pdfBytes);
  const totalPages = srcDoc.getPageCount();

  if (!Array.isArray(splitPoints) || splitPoints.length === 0) {
    // If no split points are provided, return the original document in a single-element array
    return [pdfBytes];
  }

  // Normalize, clean, and sort split points
  const points = [...new Set(splitPoints)]
    .map(p => Math.floor(p))
    .filter(p => p > 0 && p < totalPages)
    .sort((a, b) => a - b);

  // If after filtering, no valid split points remain, return original
  if (points.length === 0) {
    return [pdfBytes];
  }

  // Create range indices (0-indexed ranges)
  const ranges = [];
  let lastIndex = 0;

  for (const point of points) {
    const nextIndex = point; // point is 1-indexed, so it maps to the start index of the next document
    ranges.push(Array.from({ length: nextIndex - lastIndex }, (_, i) => lastIndex + i));
    lastIndex = nextIndex;
  }
  // Append the remaining pages
  ranges.push(Array.from({ length: totalPages - lastIndex }, (_, i) => lastIndex + i));

  const splitResults = [];

  for (const indices of ranges) {
    if (indices.length === 0) continue;
    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(srcDoc, indices);
    copiedPages.forEach(page => {
      newDoc.addPage(page);
    });
    const newBytes = await newDoc.save();
    splitResults.push(newBytes.buffer);
  }

  return splitResults;
}

/**
 * Split a PDF document into individual single-page PDF files.
 * @param {File|ArrayBuffer|Uint8Array} pdfSource The source PDF file
 * @returns {Promise<ArrayBuffer[]>} Array of single page PDFs
 */
export async function splitPDFToSinglePages(pdfSource) {
  let pdfBytes = pdfSource;
  if (pdfSource instanceof File) {
    pdfBytes = await fileToArrayBuffer(pdfSource);
  } else if (pdfSource instanceof Uint8Array) {
    pdfBytes = pdfSource.buffer;
  }

  if (!(pdfBytes instanceof ArrayBuffer)) {
    throw new Error('PDFSplitter: Invalid PDF source');
  }

  const srcDoc = await PDFDocument.load(pdfBytes);
  const totalPages = srcDoc.getPageCount();

  const results = [];
  for (let i = 0; i < totalPages; i++) {
    const newDoc = await PDFDocument.create();
    const [page] = await newDoc.copyPages(srcDoc, [i]);
    newDoc.addPage(page);
    const newBytes = await newDoc.save();
    results.push(newBytes.buffer);
  }

  return results;
}

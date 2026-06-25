// src/renderer/js/core/pdf-merger.js
import { PDFDocument } from 'pdf-lib';
import { fileToArrayBuffer } from '../utils/file-utils.js';

/**
 * Merge multiple PDF documents into a single document
 * Supports selecting specific page ranges per PDF.
 * 
 * @param {Array<File|ArrayBuffer|Uint8Array|Object>} pdfSources List of PDF sources.
 *   Can be File, ArrayBuffer, Uint8Array or an Object containing:
 *   {
 *     file: File|ArrayBuffer|Uint8Array,
 *     pages: string // e.g. "all", "1-3", "2, 4-6, 8" (1-indexed representation)
 *   }
 * @returns {Promise<ArrayBuffer>} The merged PDF ArrayBuffer
 */
export async function mergePDFs(pdfSources) {
  if (!Array.isArray(pdfSources) || pdfSources.length === 0) {
    throw new Error('PDFMerger: A non-empty list of PDF sources is required');
  }

  const mergedDoc = await PDFDocument.create();

  for (const source of pdfSources) {
    let pdfBytes = null;
    let pagesToExtract = 'all';

    // Normalize source format
    if (source && source.file) {
      // It's the object format
      pdfBytes = source.file;
      pagesToExtract = source.pages || 'all';
    } else {
      // It's a raw File, ArrayBuffer, or Uint8Array
      pdfBytes = source;
    }

    // Convert File to ArrayBuffer
    if (pdfBytes instanceof File) {
      pdfBytes = await fileToArrayBuffer(pdfBytes);
    } else if (pdfBytes instanceof Uint8Array) {
      pdfBytes = pdfBytes.buffer;
    }

    if (!(pdfBytes instanceof ArrayBuffer)) {
      console.warn('PDFMerger: Invalid PDF source encountered. Skipping.');
      continue;
    }

    // Load source document
    const srcDoc = await PDFDocument.load(pdfBytes);
    const totalPages = srcDoc.getPageCount();
    
    // Parse indices to extract (0-indexed)
    const indices = parsePageRange(pagesToExtract, totalPages);
    if (indices.length === 0) continue;

    // Copy selected pages and append to merged document
    const copiedPages = await mergedDoc.copyPages(srcDoc, indices);
    copiedPages.forEach(page => {
      mergedDoc.addPage(page);
    });
  }

  const mergedBytes = await mergedDoc.save();
  return mergedBytes.buffer;
}

/**
 * Helper to parse human-readable page ranges (e.g. "1-3, 5") to 0-indexed integer arrays
 * @param {string|number[]} rangeStr Page selector string (e.g. "1-3, 5", "all") or index array
 * @param {number} maxPages Total pages in source document
 * @returns {number[]} Array of 0-based page indices
 */
export function parsePageRange(rangeStr, maxPages) {
  if (Array.isArray(rangeStr)) {
    return rangeStr.filter(idx => idx >= 0 && idx < maxPages);
  }

  if (!rangeStr || typeof rangeStr !== 'string' || rangeStr.trim().toLowerCase() === 'all') {
    return Array.from({ length: maxPages }, (_, i) => i);
  }

  const indices = [];
  const parts = rangeStr.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = parseInt(startStr.trim(), 10) - 1;
      const end = parseInt(endStr.trim(), 10) - 1;

      if (!isNaN(start) && !isNaN(end)) {
        const lowerBound = Math.max(0, Math.min(start, end));
        const upperBound = Math.min(maxPages - 1, Math.max(start, end));
        for (let i = lowerBound; i <= upperBound; i++) {
          indices.push(i);
        }
      }
    } else {
      const pageNum = parseInt(trimmed, 10) - 1;
      if (!isNaN(pageNum) && pageNum >= 0 && pageNum < maxPages) {
        indices.push(pageNum);
      }
    }
  }

  // Remove duplicates and sort indices ascending
  return [...new Set(indices)].sort((a, b) => a - b);
}

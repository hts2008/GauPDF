// src/main/libreoffice-service.js
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import store from './store.js';

/**
 * Find the LibreOffice executable (soffice.exe)
 */
export function findLibreOffice() {
  // Check store first for user custom path
  const customPath = store.get('settings.libreofficePath');
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }

  const pathsToSearch = [
    // Standard installation paths on Windows
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    // Locally inside process.resourcesPath
    path.join(process.resourcesPath, 'resources', 'soffice.exe'),
    path.join(process.resourcesPath, 'soffice.exe'),
    // App path local resources (helpful in development or custom package builds)
    path.join(app.getAppPath(), 'resources', 'soffice.exe'),
    path.join(app.getAppPath(), 'resources', 'bin', 'soffice.exe')
  ];

  for (const p of pathsToSearch) {
    if (fs.existsSync(p)) {
      console.log(`[LibreOffice Service] Found soffice at: ${p}`);
      return p;
    }
  }

  // Fallback: Check if it's available in the system PATH (execFile will look in PATH)
  return 'soffice';
}

/**
 * Convert DOCX/XLSX/PPTX to PDF
 * @param {string} inputPath - Absolute path of the source document
 * @param {string} [outDir] - Optional custom output directory
 * @returns {Promise<{success: boolean, filePath: string, name: string}>}
 */
export async function convertToPdf(inputPath, outDir) {
  const sofficePath = findLibreOffice();
  const outputDir = outDir || path.dirname(inputPath);

  console.log(`[LibreOffice Service] Converting to PDF. Input: ${inputPath}, Output Dir: ${outputDir}`);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    await fs.promises.mkdir(outputDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    // --headless --convert-to pdf --outdir <outDir> <inputPath>
    const args = ['--headless', '--convert-to', 'pdf', '--outdir', outputDir, inputPath];
    
    execFile(sofficePath, args, (error, stdout, stderr) => {
      if (error) {
        console.error('[LibreOffice Service] Conversion to PDF failed:', error, stderr);
        return reject(error);
      }
      
      console.log('[LibreOffice Service] Conversion to PDF stdout:', stdout);
      
      const baseName = path.basename(inputPath, path.extname(inputPath));
      const resultPath = path.join(outputDir, `${baseName}.pdf`);
      
      if (fs.existsSync(resultPath)) {
        resolve({
          success: true,
          filePath: resultPath,
          name: `${baseName}.pdf`
        });
      } else {
        reject(new Error(`Converted PDF file not found at expected path: ${resultPath}`));
      }
    });
  });
}

/**
 * Convert PDF to DOCX/XLSX/PPTX
 * @param {string} inputPath - Absolute path of the source PDF
 * @param {string} targetFormat - Target extension (e.g. 'docx', 'xlsx', 'pptx')
 * @param {string} [outDir] - Optional custom output directory
 * @returns {Promise<{success: boolean, filePath: string, name: string}>}
 */
export async function convertFromPdf(inputPath, targetFormat, outDir) {
  const sofficePath = findLibreOffice();
  const format = (targetFormat || 'docx').toLowerCase();
  const outputDir = outDir || path.dirname(inputPath);

  console.log(`[LibreOffice Service] Converting PDF to ${format}. Input: ${inputPath}, Output Dir: ${outputDir}`);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    await fs.promises.mkdir(outputDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    const args = ['--headless', '--convert-to', format, '--outdir', outputDir, inputPath];
    
    execFile(sofficePath, args, (error, stdout, stderr) => {
      if (error) {
        console.error(`[LibreOffice Service] Conversion from PDF to ${format} failed:`, error, stderr);
        return reject(error);
      }

      console.log(`[LibreOffice Service] Conversion from PDF stdout:`, stdout);

      const baseName = path.basename(inputPath, path.extname(inputPath));
      const resultPath = path.join(outputDir, `${baseName}.${format}`);

      if (fs.existsSync(resultPath)) {
        resolve({
          success: true,
          filePath: resultPath,
          name: `${baseName}.${format}`
        });
      } else {
        reject(new Error(`Converted file not found at expected path: ${resultPath}`));
      }
    });
  });
}

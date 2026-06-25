/**
 * Convert a File object to ArrayBuffer
 * @param {File} file 
 * @returns {Promise<ArrayBuffer>}
 */
export function fileToArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Convert a File object to Base64 String
 * @param {File} file 
 * @returns {Promise<string>}
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // Get base64 string after comma
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Convert an ArrayBuffer to Base64 String
 * @param {ArrayBuffer} buffer 
 * @returns {string}
 */
export function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Convert a Base64 String to ArrayBuffer
 * @param {string} base64 
 * @returns {ArrayBuffer}
 */
export function base64ToArrayBuffer(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Formats file size in bytes to a human-readable string
 * @param {number} bytes 
 * @param {number} decimals 
 * @returns {string}
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Extract extension from filename
 * @param {string} filename 
 * @returns {string}
 */
export function getFileExtension(filename) {
  if (!filename) return '';
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase();
}

/**
 * Download a Blob as a file
 * @param {Blob} blob 
 * @param {string} filename 
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download an ArrayBuffer as a file
 * @param {ArrayBuffer} buffer 
 * @param {string} filename 
 * @param {string} mimeType 
 */
export function downloadArrayBuffer(buffer, filename, mimeType = 'application/pdf') {
  const blob = new Blob([buffer], { type: mimeType });
  downloadBlob(blob, filename);
}

/**
 * Download a Base64 string as a file
 * @param {string} base64 
 * @param {string} filename 
 * @param {string} mimeType 
 */
export function downloadBase64(base64, filename, mimeType = 'application/pdf') {
  const buffer = base64ToArrayBuffer(base64);
  downloadArrayBuffer(buffer, filename, mimeType);
}

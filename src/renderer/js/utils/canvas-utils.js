// src/renderer/js/utils/canvas-utils.js

/**
 * Get pointer position on a Fabric.js canvas, respecting current zoom and pan.
 * @param {fabric.Canvas} fabricCanvas 
 * @param {Event} event 
 * @returns {{x: number, y: number}}
 */
export function getCanvasPointer(fabricCanvas, event) {
  const pointer = fabricCanvas.getPointer(event);
  return {
    x: pointer.x,
    y: pointer.y
  };
}

/**
 * Zoom a Fabric.js canvas to a specific level, centered at a given point.
 * @param {fabric.Canvas} fabricCanvas 
 * @param {number} zoomLevel 
 * @param {fabric.Point} [point] Zoom center point, defaults to center of canvas
 */
export function zoomCanvas(fabricCanvas, zoomLevel, point) {
  let targetPoint = point;
  if (!targetPoint) {
    targetPoint = new fabric.Point(fabricCanvas.getWidth() / 2, fabricCanvas.getHeight() / 2);
  }
  
  // Constrain zoom level (e.g. between 0.1 and 10)
  const constrainedZoom = Math.max(0.1, Math.min(10, zoomLevel));
  fabricCanvas.zoomToPoint(targetPoint, constrainedZoom);
  fabricCanvas.requestRenderAll();
}

/**
 * Center a Fabric object horizontally and vertically in the canvas.
 * @param {fabric.Canvas} fabricCanvas 
 * @param {fabric.Object} obj 
 */
export function centerObject(fabricCanvas, obj) {
  fabricCanvas.centerObject(obj);
  obj.setCoords();
  fabricCanvas.requestRenderAll();
}

/**
 * Convert a Fabric canvas to an image data URL (PNG)
 * @param {fabric.Canvas} fabricCanvas 
 * @param {Object} [options] 
 * @returns {string} Data URL
 */
export function fabricToImageData(fabricCanvas, options = {}) {
  const defaultOptions = {
    format: 'png',
    quality: 1,
    multiplier: 1
  };
  return fabricCanvas.toDataURL(Object.assign({}, defaultOptions, options));
}

/**
 * Safely resize a Fabric.js canvas and re-render
 * @param {fabric.Canvas} fabricCanvas 
 * @param {number} width 
 * @param {number} height 
 */
export function resizeFabricCanvas(fabricCanvas, width, height) {
  fabricCanvas.setDimensions({ width, height });
  fabricCanvas.requestRenderAll();
}

/**
 * Apply theme-based settings to a Fabric.js canvas
 * @param {fabric.Canvas} fabricCanvas 
 * @param {'light'|'dark'} theme 
 */
export function applyThemeToFabric(fabricCanvas, theme) {
  // Setup guidelines or selection border colors based on theme
  const isDark = theme === 'dark';
  const strokeColor = isDark ? '#ffffff' : '#000000';
  
  fabricCanvas.forEachObject((obj) => {
    // If it's a guide or text/shape, we could adjust properties,
    // but usually, we just adjust the selection handle colors:
    obj.borderColor = isDark ? '#2196f3' : '#1565c0';
    obj.cornerColor = isDark ? '#90caf9' : '#1e88e5';
    obj.cornerStrokeColor = isDark ? '#2196f3' : '#1565c0';
  });
  
  fabricCanvas.requestRenderAll();
}

/**
 * Convert Fabric/CSS color representations to standard Hex format
 * @param {string} color 
 * @returns {string} Hex color representation
 */
export function fabricColorToHex(color) {
  if (!color) return '#000000';
  if (color.startsWith('#')) return color;
  
  // Fabric/Canvas helper for simple RGB/RGBA string to Hex
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.fillStyle = color;
  return ctx.fillStyle;
}

/**
 * Utility to generate SVG path data for drawing a line with an arrowhead
 * @param {number} sx Start X
 * @param {number} sy Start Y
 * @param {number} ex End X
 * @param {number} ey End Y
 * @returns {string} SVG Path string
 */
export function getArrowPath(sx, sy, ex, ey) {
  const angle = Math.atan2(ey - sy, ex - sx);
  const headLength = 15; // Length of arrow head
  
  // Left and right wing coordinates of arrow head
  const x1 = ex - headLength * Math.cos(angle - Math.PI / 6);
  const y1 = ey - headLength * Math.sin(angle - Math.PI / 6);
  const x2 = ex - headLength * Math.cos(angle + Math.PI / 6);
  const y2 = ey - headLength * Math.sin(angle + Math.PI / 6);
  
  return `M ${sx} ${sy} L ${ex} ${ey} M ${ex} ${ey} L ${x1} ${y1} M ${ex} ${ey} L ${x2} ${y2}`;
}

/**
 * Configure Fabric.js canvas brush settings for freehand drawing or highlighting
 * @param {fabric.Canvas} canvas Fabric Canvas instance
 * @param {'draw'|'highlight'} brushType Type of brush
 * @param {Object} settings Brush settings (strokeColor, strokeWidth)
 */
export function configureDrawingBrush(canvas, brushType, settings = {}) {
  const fabric = window.fabric;
  if (!fabric) return;

  canvas.isDrawingMode = true;

  if (brushType === 'highlight') {
    // Highlight uses a semi-transparent thick yellow brush by default
    canvas.freeDrawingBrush.color = settings.highlightColor || 'rgba(255, 235, 59, 0.45)';
    canvas.freeDrawingBrush.width = settings.highlightWidth || 24;
  } else {
    // Normal freehand brush
    canvas.freeDrawingBrush.color = settings.strokeColor || '#ff0000';
    canvas.freeDrawingBrush.width = settings.strokeWidth || 3;
  }
}

/**
 * Annotation Object Factory
 */
export class AnnotationFactory {
  /**
   * Create an IText text annotation
   * @param {number} x Left
   * @param {number} y Top
   * @param {Object} settings Text settings
   * @returns {fabric.IText}
   */
  static createText(x, y, settings = {}) {
    const fabric = window.fabric;
    if (!fabric) return null;

    return new fabric.IText('Double click to edit', {
      left: x,
      top: y,
      fontFamily: settings.fontFamily || 'Arial',
      fontSize: settings.fontSize || 18,
      fill: settings.textColor || '#ff0000',
      selectable: true,
      hasControls: true
    });
  }

  /**
   * Create a Rectangle shape annotation
   * @param {number} x Left
   * @param {number} y Top
   * @param {Object} settings Shape settings
   * @returns {fabric.Rect}
   */
  static createRect(x, y, settings = {}) {
    const fabric = window.fabric;
    if (!fabric) return null;

    return new fabric.Rect({
      left: x,
      top: y,
      width: 0,
      height: 0,
      stroke: settings.strokeColor || '#ff0000',
      fill: settings.fillColor || 'transparent',
      strokeWidth: settings.strokeWidth || 3,
      selectable: false,
      hasControls: false
    });
  }

  /**
   * Create a Circle shape annotation
   * @param {number} x Left
   * @param {number} y Top
   * @param {Object} settings Shape settings
   * @returns {fabric.Circle}
   */
  static createCircle(x, y, settings = {}) {
    const fabric = window.fabric;
    if (!fabric) return null;

    return new fabric.Circle({
      left: x,
      top: y,
      radius: 0,
      stroke: settings.strokeColor || '#ff0000',
      fill: settings.fillColor || 'transparent',
      strokeWidth: settings.strokeWidth || 3,
      selectable: false,
      hasControls: false
    });
  }

  /**
   * Create a Line shape annotation
   * @param {number} x Start X
   * @param {number} y Start Y
   * @param {Object} settings Shape settings
   * @returns {fabric.Line}
   */
  static createLine(x, y, settings = {}) {
    const fabric = window.fabric;
    if (!fabric) return null;

    return new fabric.Line([x, y, x, y], {
      stroke: settings.strokeColor || '#ff0000',
      strokeWidth: settings.strokeWidth || 3,
      selectable: false,
      hasControls: false
    });
  }

  /**
   * Create an Arrow shape annotation
   * @param {number} x Start X
   * @param {number} y Start Y
   * @param {Object} settings Shape settings
   * @returns {fabric.Path}
   */
  static createArrow(x, y, settings = {}) {
    const fabric = window.fabric;
    if (!fabric) return null;

    const pathData = getArrowPath(x, y, x, y);
    return new fabric.Path(pathData, {
      stroke: settings.strokeColor || '#ff0000',
      strokeWidth: settings.strokeWidth || 3,
      fill: 'transparent',
      selectable: false,
      hasControls: false
    });
  }
}

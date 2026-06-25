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
      opacity: settings.opacity !== undefined ? settings.opacity : 1.0,
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
      opacity: settings.opacity !== undefined ? settings.opacity : 1.0,
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
      opacity: settings.opacity !== undefined ? settings.opacity : 1.0,
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
      opacity: settings.opacity !== undefined ? settings.opacity : 1.0,
      selectable: false,
      hasControls: false
    });
  }

  /**
   * Create a Note Circle annotation
   * @param {number} x Left
   * @param {number} y Top
   * @param {Object} settings Note settings
   * @returns {fabric.Group}
   */
  static createNoteCircle(x, y, settings = {}) {
    const fabric = window.fabric;
    if (!fabric) return null;

    const circle = new fabric.Circle({
      radius: 12,
      fill: settings.fillColor || '#ffc107',
      stroke: settings.strokeColor || '#e0a800',
      strokeWidth: 2,
      left: 0,
      top: 0
    });

    const text = new fabric.Text('N', {
      fontSize: 12,
      fontWeight: 'bold',
      fill: settings.textColor || '#ffffff',
      left: 8,
      top: 5,
      fontFamily: settings.fontFamily || 'Arial'
    });

    return new fabric.Group([circle, text], {
      left: x,
      top: y,
      selectable: true,
      hasControls: false,
      isNoteCircle: true,
      noteText: settings.noteText || 'Enter note here...',
      opacity: settings.opacity !== undefined ? settings.opacity : 1.0
    });
  }

  /**
   * Create a Text Callout annotation (Textbox with borders & background)
   * @param {number} x Left
   * @param {number} y Top
   * @param {Object} settings Styling settings
   * @returns {fabric.Textbox}
   */
  static createTextCallout(x, y, settings = {}) {
    const fabric = window.fabric;
    if (!fabric) return null;

    return new fabric.Textbox(settings.text || 'Callout text...', {
      left: x,
      top: y,
      width: 150,
      fontSize: settings.fontSize || 14,
      fontFamily: settings.fontFamily || 'Arial',
      fill: settings.textColor || '#ff0000',
      backgroundColor: settings.fillColor || '#ffffff',
      stroke: settings.strokeColor || '#ff0000',
      strokeWidth: settings.strokeWidth || 2,
      padding: 6,
      rx: 4,
      ry: 4,
      isTextCallout: true,
      opacity: settings.opacity !== undefined ? settings.opacity : 1.0,
      selectable: true,
      hasControls: true
    });
  }

  /**
   * Create a Stamp annotation
   * @param {number} x Left
   * @param {number} y Top
   * @param {string} stampText Stamp content (e.g. APPROVED, DRAFT)
   * @param {Object} settings Styling settings
   * @returns {fabric.Group}
   */
  static createStamp(x, y, stampText = 'APPROVED', settings = {}) {
    const fabric = window.fabric;
    if (!fabric) return null;

    let color = '#10b981';
    if (['REJECTED', 'VOID', 'EXPIRED'].includes(stampText.toUpperCase())) {
      color = '#ef4444';
    } else if (['CONFIDENTIAL', 'IMPORTANT'].includes(stampText.toUpperCase())) {
      color = '#f59e0b';
    } else if (['DRAFT', 'COPY'].includes(stampText.toUpperCase())) {
      color = '#6366f1';
    }

    const border = new fabric.Rect({
      width: 130,
      height: 40,
      fill: 'rgba(255, 255, 255, 0.9)',
      stroke: color,
      strokeWidth: 3,
      rx: 4,
      ry: 4,
      left: 0,
      top: 0
    });

    const textObj = new fabric.Text(stampText.toUpperCase(), {
      fontFamily: 'Courier New, monospace',
      fontSize: 14,
      fontWeight: 'bold',
      fill: color,
      left: 15,
      top: 12,
      charSpacing: 100
    });

    return new fabric.Group([border, textObj], {
      left: x,
      top: y,
      angle: -10,
      selectable: true,
      hasControls: true,
      isStamp: true,
      stampText: stampText,
      opacity: settings.opacity !== undefined ? settings.opacity : 1.0
    });
  }
}

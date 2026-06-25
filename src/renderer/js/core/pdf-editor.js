// src/renderer/js/core/pdf-editor.js
import { 
  HistoryManager, 
  AddObjectCommand, 
  RemoveObjectCommand, 
  ModifyObjectCommand 
} from '../utils/history.js';
import { getCanvasPointer } from '../utils/canvas-utils.js';

export class PDFEditor {
  /**
   * @param {PDFViewer} pdfViewer The active PDFViewer instance
   * @param {HistoryManager} [historyManager] Optional history manager instance
   */
  constructor(pdfViewer, historyManager) {
    if (!pdfViewer) {
      throw new Error('PDFEditor: PDFViewer instance is required');
    }
    this.viewer = pdfViewer;
    this.history = historyManager || new HistoryManager();
    this.canvases = new Map(); // pageNumber -> fabric.Canvas
    this.currentMode = 'select'; // select, draw (freehand), text, rect, circle, line, arrow
    
    // Default style settings for editing
    this.drawingSettings = {
      strokeColor: '#ff0000',
      fillColor: 'transparent',
      strokeWidth: 3,
      fontSize: 18,
      fontFamily: 'Arial',
      textColor: '#ff0000'
    };

    this.isUndoRedoing = false;
    this.activeDrawingObject = null;
    this.startX = 0;
    this.startY = 0;
    
    // Keep track of object modification before state
    this._objectBeforeState = null;

    // Connect to PDFViewer events
    this.viewer.on('pageRendered', (data) => this._onPageRendered(data));
    
    // Global mouseup window listener to handle drag draw endings outside canvas boundaries
    window.addEventListener('mouseup', () => this._handleGlobalMouseUp());
  }

  /**
   * Setup or update Fabric canvas overlay when page is rendered
   */
  _onPageRendered(data) {
    const fabric = window.fabric;
    if (!fabric) {
      console.warn('Fabric.js is not loaded. Skipping annotation layer initialization.');
      return;
    }

    const { pageNumber, width, height, annotationCanvas } = data;
    let fabricCanvas = this.canvases.get(pageNumber);

    if (!fabricCanvas) {
      // Allow mouse events to reach our overlay canvas
      annotationCanvas.style.pointerEvents = 'auto';

      fabricCanvas = new fabric.Canvas(annotationCanvas, {
        width: width,
        height: height,
        selection: true,
        preserveObjectStacking: true
      });

      this.canvases.set(pageNumber, fabricCanvas);
      this._setupCanvasEvents(fabricCanvas);
    } else {
      // Update dimensions and zoom level
      fabricCanvas.setDimensions({ width, height });
      fabricCanvas.setZoom(this.viewer.scale);
      fabricCanvas.requestRenderAll();
    }

    // Apply the active tool state to the newly rendered canvas
    this._applyModeToCanvas(fabricCanvas);
  }

  /**
   * Bind event handlers to a Fabric.js canvas to track history and drawing interactions
   * @param {fabric.Canvas} canvas 
   */
  _setupCanvasEvents(canvas) {
    const fabric = window.fabric;

    canvas.on('mouse:down', (e) => this._handleMouseDown(canvas, e));
    canvas.on('mouse:move', (e) => this._handleMouseMove(canvas, e));
    canvas.on('mouse:up', (e) => this._handleMouseUp(canvas, e));

    // Capture initial object transform states for modification command
    canvas.on('before:transform', (e) => {
      const obj = e.transform.target;
      if (obj) {
        this._objectBeforeState = {
          left: obj.left,
          top: obj.top,
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          angle: obj.angle,
          skewX: obj.skewX,
          skewY: obj.skewY
        };
      }
    });

    // Object modification (move, resize, rotate) completed
    canvas.on('object:modified', (e) => {
      const obj = e.target;
      if (obj && this._objectBeforeState && !this.isUndoRedoing) {
        const before = this._objectBeforeState;
        const after = {
          left: obj.left,
          top: obj.top,
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          angle: obj.angle,
          skewX: obj.skewX,
          skewY: obj.skewY
        };

        const command = new ModifyObjectCommand(canvas, obj, before, after);
        this.history.execute(command);
        this._objectBeforeState = null;
      }
    });

    // Capture text edit states
    canvas.on('text:editing:entered', (e) => {
      const obj = e.target;
      if (obj) {
        obj._originalText = obj.text;
      }
    });

    canvas.on('text:editing:exited', (e) => {
      const obj = e.target;
      if (obj && obj._originalText !== obj.text && !this.isUndoRedoing) {
        const before = { text: obj._originalText };
        const after = { text: obj.text };
        const command = new ModifyObjectCommand(canvas, obj, before, after);
        this.history.execute(command);
      }
    });

    // Freehand drawing completed
    canvas.on('path:created', (e) => {
      if (this.isUndoRedoing) return;
      const path = e.path;
      // Push history
      const command = new AddObjectCommand(canvas, path);
      // Fabric auto-adds the drawn path, so we register the action, but skip repeating double add in command execution
      this.history.undoStack.push(command);
      this.history.redoStack = [];
      this.history._notify();
    });
  }

  /**
   * Set the active editing mode/tool
   * @param {'select'|'draw'|'text'|'rect'|'circle'|'line'|'arrow'} mode 
   */
  setMode(mode) {
    if (this.currentMode === mode) return;
    this.currentMode = mode;
    this.canvases.forEach(canvas => this._applyModeToCanvas(canvas));
  }

  /**
   * Apply drawing mode configurations directly to a Fabric canvas
   * @param {fabric.Canvas} canvas 
   */
  _applyModeToCanvas(canvas) {
    const fabric = window.fabric;
    if (!fabric) return;

    // Reset default properties
    canvas.isDrawingMode = false;
    canvas.selection = this.currentMode === 'select';
    
    // Enable or disable object selections depending on tool
    canvas.forEachObject((obj) => {
      obj.selectable = this.currentMode === 'select';
      obj.hoverCursor = this.currentMode === 'select' ? 'move' : 'crosshair';
    });

    if (this.currentMode === 'draw') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = this.drawingSettings.strokeColor;
      canvas.freeDrawingBrush.width = this.drawingSettings.strokeWidth;
    }

    canvas.defaultCursor = this.currentMode === 'select' ? 'default' : 'crosshair';
    canvas.requestRenderAll();
  }

  /**
   * Update drawing color, fonts, stroke size dynamically
   * @param {Object} settings Partial settings configurations
   */
  updateSettings(settings) {
    Object.assign(this.drawingSettings, settings);
    
    // Apply changes to active drawings brushes
    this.canvases.forEach(canvas => {
      if (canvas.isDrawingMode && canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = this.drawingSettings.strokeColor;
        canvas.freeDrawingBrush.width = this.drawingSettings.strokeWidth;
      }
      
      // Update selected object styling on active canvases
      const activeObj = canvas.getActiveObject();
      if (activeObj && !this.isUndoRedoing) {
        const before = {};
        const after = {};
        let modified = false;

        // Apply settings changes depending on object types
        if (activeObj.type === 'i-text') {
          if (settings.textColor) {
            before.fill = activeObj.fill;
            activeObj.set('fill', settings.textColor);
            after.fill = settings.textColor;
            modified = true;
          }
          if (settings.fontSize) {
            before.fontSize = activeObj.fontSize;
            activeObj.set('fontSize', settings.fontSize);
            after.fontSize = settings.fontSize;
            modified = true;
          }
          if (settings.fontFamily) {
            before.fontFamily = activeObj.fontFamily;
            activeObj.set('fontFamily', settings.fontFamily);
            after.fontFamily = settings.fontFamily;
            modified = true;
          }
        } else {
          // Geometry shape
          if (settings.strokeColor) {
            before.stroke = activeObj.stroke;
            activeObj.set('stroke', settings.strokeColor);
            after.stroke = settings.strokeColor;
            modified = true;
          }
          if (settings.fillColor) {
            before.fill = activeObj.fill;
            activeObj.set('fill', settings.fillColor);
            after.fill = settings.fillColor;
            modified = true;
          }
          if (settings.strokeWidth) {
            before.strokeWidth = activeObj.strokeWidth;
            activeObj.set('strokeWidth', settings.strokeWidth);
            after.strokeWidth = settings.strokeWidth;
            modified = true;
          }
        }

        if (modified) {
          const command = new ModifyObjectCommand(canvas, activeObj, before, after);
          this.history.execute(command);
        }
      }
    });
  }

  _handleMouseDown(canvas, options) {
    if (this.currentMode === 'select' || this.currentMode === 'draw') return;
    
    const fabric = window.fabric;
    const pointer = getCanvasPointer(canvas, options.e);
    this.startX = pointer.x;
    this.startY = pointer.y;

    const strokeColor = this.drawingSettings.strokeColor;
    const fillColor = this.drawingSettings.fillColor;
    const strokeWidth = this.drawingSettings.strokeWidth;

    if (this.currentMode === 'text') {
      const text = new fabric.IText('Double click to edit', {
        left: pointer.x,
        top: pointer.y,
        fontFamily: this.drawingSettings.fontFamily,
        fontSize: this.drawingSettings.fontSize,
        fill: this.drawingSettings.textColor,
        selectable: true,
        hasControls: true
      });
      
      canvas.add(text);
      canvas.setActiveObject(text);
      
      const command = new AddObjectCommand(canvas, text);
      this.history.execute(command);
      
      text.enterEditing();
      text.selectAll();
      
      this.setMode('select'); // Automatically revert back to select
      return;
    }

    // Geometry shapes initialization
    switch (this.currentMode) {
      case 'rect':
        this.activeDrawingObject = new fabric.Rect({
          left: this.startX,
          top: this.startY,
          width: 0,
          height: 0,
          stroke: strokeColor,
          fill: fillColor,
          strokeWidth: strokeWidth,
          selectable: false,
          hasControls: false
        });
        break;
      case 'circle':
        this.activeDrawingObject = new fabric.Circle({
          left: this.startX,
          top: this.startY,
          radius: 0,
          stroke: strokeColor,
          fill: fillColor,
          strokeWidth: strokeWidth,
          selectable: false,
          hasControls: false
        });
        break;
      case 'line':
        this.activeDrawingObject = new fabric.Line(
          [this.startX, this.startY, this.startX, this.startY],
          {
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            selectable: false,
            hasControls: false
          }
        );
        break;
      case 'arrow':
        // Represent arrows as SVG paths
        this.activeDrawingObject = new fabric.Path(this._getArrowPath(this.startX, this.startY, this.startX, this.startY), {
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          fill: 'transparent',
          selectable: false,
          hasControls: false
        });
        break;
    }

    if (this.activeDrawingObject) {
      canvas.add(this.activeDrawingObject);
      canvas.requestRenderAll();
    }
  }

  _handleMouseMove(canvas, options) {
    if (!this.activeDrawingObject) return;

    const pointer = getCanvasPointer(canvas, options.e);
    const w = pointer.x - this.startX;
    const h = pointer.y - this.startY;

    switch (this.currentMode) {
      case 'rect':
        this.activeDrawingObject.set({
          left: w > 0 ? this.startX : pointer.x,
          top: h > 0 ? this.startY : pointer.y,
          width: Math.abs(w),
          height: Math.abs(h)
        });
        break;
      case 'circle':
        const radius = Math.sqrt(w * w + h * h) / 2;
        this.activeDrawingObject.set({
          left: Math.min(this.startX, pointer.x),
          top: Math.min(this.startY, pointer.y),
          radius: radius
        });
        break;
      case 'line':
        this.activeDrawingObject.set({
          x2: pointer.x,
          y2: pointer.y
        });
        break;
      case 'arrow':
        canvas.remove(this.activeDrawingObject);
        const pathData = this._getArrowPath(this.startX, this.startY, pointer.x, pointer.y);
        
        const strokeColor = this.drawingSettings.strokeColor;
        const strokeWidth = this.drawingSettings.strokeWidth;
        
        this.activeDrawingObject = new fabric.Path(pathData, {
          stroke: strokeColor,
          strokeWidth: strokeWidth,
          fill: 'transparent',
          selectable: false,
          hasControls: false
        });
        
        canvas.add(this.activeDrawingObject);
        break;
    }

    canvas.requestRenderAll();
  }

  _handleMouseUp(canvas, options) {
    if (!this.activeDrawingObject) return;

    // Convert drawn object to a fully selectable/editable shape
    this.activeDrawingObject.set({
      selectable: true,
      hasControls: true
    });
    this.activeDrawingObject.setCoords();

    const command = new AddObjectCommand(canvas, this.activeDrawingObject);
    this.history.execute(command);

    this.activeDrawingObject = null;
    canvas.requestRenderAll();
  }

  _handleGlobalMouseUp() {
    // If user releases mouse outside canvas during drawing, clean up
    if (this.activeDrawingObject) {
      const canvas = this.activeDrawingObject.canvas;
      if (canvas) {
        this._handleMouseUp(canvas, null);
      }
    }
  }

  /**
   * Construct SVG path data for drawing a line with an arrowhead
   */
  _getArrowPath(sx, sy, ex, ey) {
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
   * Delete currently selected object(s) on any canvas page
   */
  deleteSelected() {
    this.canvases.forEach(canvas => {
      const activeObjects = canvas.getActiveObjects();
      if (activeObjects.length > 0 && !this.isUndoRedoing) {
        const command = new RemoveObjectCommand(canvas, activeObjects);
        this.history.execute(command);
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
    });
  }

  /**
   * Undo last operation
   */
  undo() {
    this.isUndoRedoing = true;
    this.history.undo();
    this.isUndoRedoing = false;
  }

  /**
   * Redo last undone operation
   */
  redo() {
    this.isUndoRedoing = true;
    this.history.redo();
    this.isUndoRedoing = false;
  }

  /**
   * Export all annotations from Fabric.js canvases as structured JSON data
   * @returns {Object[]} An array of page-specific annotations
   */
  exportAnnotations() {
    const data = [];
    this.canvases.forEach((canvas, pageNum) => {
      const json = canvas.toJSON(); // Extracts layers/objects
      data.push({
        pageNumber: pageNum,
        annotations: json.objects
      });
    });
    return data;
  }

  /**
   * Import annotations from structured JSON data
   * @param {Object[]} annotationsList 
   */
  importAnnotations(annotationsList) {
    if (!Array.isArray(annotationsList)) return;
    this.isUndoRedoing = true; // Disable history tracking while loading

    annotationsList.forEach(item => {
      const canvas = this.canvases.get(item.pageNumber);
      if (canvas && Array.isArray(item.annotations)) {
        canvas.clear();
        
        // Use Fabric parseObjects API to restore elements
        window.fabric.util.enlivenObjects(item.annotations, (enlivenedObjects) => {
          enlivenedObjects.forEach(obj => {
            canvas.add(obj);
          });
          canvas.requestRenderAll();
        });
      }
    });

    this.history.clear();
    this.isUndoRedoing = false;
  }

  /**
   * Clear all annotations
   */
  clearAll() {
    this.canvases.forEach(canvas => {
      canvas.clear();
      canvas.requestRenderAll();
    });
    this.history.clear();
  }

  /**
   * Clean up all Fabric instances
   */
  destroy() {
    window.removeEventListener('mouseup', () => this._handleGlobalMouseUp());
    this.canvases.forEach(canvas => {
      canvas.dispose();
    });
    this.canvases.clear();
    this.history.clear();
  }
}

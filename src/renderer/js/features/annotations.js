/* src/renderer/js/features/annotations.js */

export class AnnotationsModule {
  constructor(appInstance) {
    this.appInstance = appInstance;
    this.activeColor = '#6366f1';
    this.activeStrokeWidth = 3;
    this.undoStack = [];
    this.redoStack = [];
  }

  // Bind a Fabric canvas instance to this annotations manager
  bindCanvas(pageIndex, canvas) {
    // Enable selections by default
    canvas.selection = true;
    canvas.isDrawingMode = false;

    // Monitor object additions/changes for Undo/Redo tracking
    canvas.on('object:added', () => this.saveState(canvas));
    canvas.on('object:modified', () => this.saveState(canvas));
    canvas.on('object:removed', () => this.saveState(canvas));

    // Monitor selections to update the Properties Inspector
    canvas.on('selection:created', (e) => this.onObjectSelected(e.selected[0]));
    canvas.on('selection:updated', (e) => this.onObjectSelected(e.selected[0]));
    canvas.on('selection:cleared', () => this.onSelectionCleared());

    // Mouse click event to place text annotations or stamps on the page
    canvas.on('mouse:down', (options) => {
      const tool = this.appInstance.toolbar.activeTool;
      const pointer = canvas.getPointer(options.e);

      if (tool === 'text') {
        this.addTextAnnotation(canvas, pointer.x, pointer.y);
      } else if (tool === 'stamp') {
        this.addStampAnnotation(canvas, 'APPROVED', pointer.x, pointer.y);
      } else if (tool === 'note') {
        this.addNoteAnnotation(canvas, pointer.x, pointer.y);
      } else if (tool === 'eraser') {
        // Eraser removes target object
        if (options.target) {
          canvas.remove(options.target);
          canvas.renderAll();
        }
      }
    });

    this.applyCurrentToolSettings(canvas);
  }

  applyCurrentToolSettings(canvas) {
    const tool = this.appInstance.toolbar.activeTool;

    // Reset Drawing Brush
    canvas.isDrawingMode = false;

    if (tool === 'draw') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = this.activeColor;
      canvas.freeDrawingBrush.width = this.activeStrokeWidth;
    } else if (tool === 'highlight') {
      canvas.isDrawingMode = true;
      // Semi-transparent yellow highlight stroke
      canvas.freeDrawingBrush.color = 'rgba(255, 235, 59, 0.45)';
      canvas.freeDrawingBrush.width = 24;
    } else if (tool === 'select') {
      canvas.forEachObject(obj => {
        obj.selectable = true;
        obj.evented = true;
      });
    } else {
      // For comment placement tools, disable standard object selection interactions
      canvas.forEachObject(obj => {
        obj.selectable = false;
        obj.evented = true;
      });
    }
  }

  // --- ANNOTATION CREATION ---
  addTextAnnotation(canvas, x, y) {
    const text = new fabric.IText('Nhập nội dung...', {
      left: x,
      top: y,
      fontFamily: 'Inter, sans-serif',
      fontSize: 14,
      fill: this.activeColor,
      editable: true
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    text.enterEditing();
    canvas.renderAll();

    // Reset tool back to select after adding
    this.appInstance.toolbar.setTool('select');
  }

  addStampAnnotation(canvas, label, x, y) {
    const group = new fabric.Group([], {
      left: x,
      top: y,
      selectable: true,
      subTargetCheck: true
    });

    const border = new fabric.Rect({
      width: 120,
      height: 40,
      fill: 'rgba(16, 185, 129, 0.08)',
      stroke: '#10b981',
      strokeWidth: 2,
      rx: 4,
      ry: 4
    });

    const text = new fabric.Text(label, {
      fontFamily: 'Inter, sans-serif',
      fontSize: 13,
      fontWeight: 'bold',
      fill: '#10b981',
      left: 14,
      top: 12
    });

    group.addWithUpdate(border);
    group.addWithUpdate(text);
    
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.renderAll();
    this.appInstance.toolbar.setTool('select');
  }

  addNoteAnnotation(canvas, x, y) {
    const circle = new fabric.Circle({
      radius: 12,
      fill: '#f59e0b',
      stroke: '#ffffff',
      strokeWidth: 2,
      left: x,
      top: y,
      hasControls: false
    });
    
    // Custom note data stored inside object
    circle.noteText = 'Nhập ghi chú tại đây...';
    circle.isNote = true;

    canvas.add(circle);
    canvas.setActiveObject(circle);
    canvas.renderAll();
    this.appInstance.toolbar.setTool('select');

    // Prompt note text
    const txt = prompt('Nhập nội dung ghi chú:', circle.noteText);
    if (txt !== null) {
      circle.noteText = txt;
    }
  }

  // --- PROPERTIES UPDATES ---
  onObjectSelected(obj) {
    let type = 'unknown';
    if (obj.type === 'i-text' || obj.type === 'text') type = 'text';
    else if (obj.type === 'path') type = 'drawing';

    this.appInstance.sidebar.showProperties(type, obj, (updatedProps) => {
      this.updateActiveObjectProperties(updatedProps);
    });
  }

  onSelectionCleared() {
    this.appInstance.sidebar.clearProperties();
  }

  updateActiveObjectProperties(props) {
    const tab = this.appInstance.tabs.getActiveTab();
    if (!tab) return;

    // Apply edits to active object in all tab canvases
    Object.values(tab.fabricInstances).forEach(canvas => {
      const activeObj = canvas.getActiveObject();
      if (activeObj) {
        activeObj.set(props);
        canvas.renderAll();
      }
    });
  }

  // --- PROPERTIES BAR SETTERS ---
  setColor(color) {
    this.activeColor = color;
    console.log('Annotation active color:', color);
    
    const tab = this.appInstance.tabs.getActiveTab();
    if (!tab) return;

    Object.values(tab.fabricInstances).forEach(canvas => {
      // Sync color picker to current drawing brush too
      if (canvas.isDrawingMode) {
        canvas.freeDrawingBrush.color = color;
      }
      
      const activeObj = canvas.getActiveObject();
      if (activeObj) {
        if (activeObj.type === 'i-text' || activeObj.type === 'text') {
          activeObj.set('fill', color);
        } else {
          activeObj.set('stroke', color);
        }
        canvas.renderAll();
      }
    });
  }

  setStrokeWidth(width) {
    this.activeStrokeWidth = width;
    console.log('Annotation stroke width:', width);
    
    const tab = this.appInstance.tabs.getActiveTab();
    if (!tab) return;

    Object.values(tab.fabricInstances).forEach(canvas => {
      if (canvas.isDrawingMode) {
        canvas.freeDrawingBrush.width = width;
      }

      const activeObj = canvas.getActiveObject();
      if (activeObj && activeObj.type === 'path') {
        activeObj.set('strokeWidth', width);
        canvas.renderAll();
      }
    });
  }

  // --- ACTIONS (Delete, Undo, Redo) ---
  deleteSelected() {
    const tab = this.appInstance.tabs.getActiveTab();
    if (!tab) return;

    Object.values(tab.fabricInstances).forEach(canvas => {
      const activeObj = canvas.getActiveObject();
      if (activeObj) {
        canvas.remove(activeObj);
        canvas.discardActiveObject();
        canvas.renderAll();
      }
    });
  }

  saveState(canvas) {
    // Basic undo state tracking
    const state = JSON.stringify(canvas);
    this.undoStack.push(state);
    // Cap undo stack size
    if (this.undoStack.length > 20) this.undoStack.shift();
    this.redoStack = []; // Clear redo stack on new action
  }

  undo() {
    const tab = this.appInstance.tabs.getActiveTab();
    if (!tab) return;

    Object.values(tab.fabricInstances).forEach(canvas => {
      if (this.undoStack.length > 0) {
        const lastState = this.undoStack.pop();
        this.redoStack.push(JSON.stringify(canvas));
        canvas.loadFromJSON(lastState, () => {
          canvas.renderAll();
        });
      }
    });
  }

  redo() {
    const tab = this.appInstance.tabs.getActiveTab();
    if (!tab) return;

    Object.values(tab.fabricInstances).forEach(canvas => {
      if (this.redoStack.length > 0) {
        const nextState = this.redoStack.pop();
        this.undoStack.push(JSON.stringify(canvas));
        canvas.loadFromJSON(nextState, () => {
          canvas.renderAll();
        });
      }
    });
  }
}

// src/renderer/js/utils/history.js

/**
 * Base Command interface
 */
export class Command {
  execute() {}
  undo() {}
}

/**
 * Command for adding one or multiple objects to the canvas
 */
export class AddObjectCommand extends Command {
  /**
   * @param {fabric.Canvas} canvas 
   * @param {fabric.Object|fabric.Object[]} objects 
   */
  constructor(canvas, objects) {
    super();
    this.canvas = canvas;
    this.objects = Array.isArray(objects) ? objects : [objects];
  }

  execute() {
    this.objects.forEach(obj => {
      this.canvas.add(obj);
    });
    this.canvas.requestRenderAll();
  }

  undo() {
    this.objects.forEach(obj => {
      this.canvas.remove(obj);
    });
    this.canvas.requestRenderAll();
  }
}

/**
 * Command for removing one or multiple objects from the canvas
 */
export class RemoveObjectCommand extends Command {
  /**
   * @param {fabric.Canvas} canvas 
   * @param {fabric.Object|fabric.Object[]} objects 
   */
  constructor(canvas, objects) {
    super();
    this.canvas = canvas;
    this.objects = Array.isArray(objects) ? objects : [objects];
  }

  execute() {
    this.objects.forEach(obj => {
      this.canvas.remove(obj);
    });
    this.canvas.requestRenderAll();
  }

  undo() {
    this.objects.forEach(obj => {
      this.canvas.add(obj);
    });
    this.canvas.requestRenderAll();
  }
}

/**
 * Command for modifying object properties (moving, scaling, rotating, text edit, styling)
 */
export class ModifyObjectCommand extends Command {
  /**
   * @param {fabric.Canvas} canvas 
   * @param {fabric.Object|fabric.Object[]} objects 
   * @param {Object|Object[]} beforeStates Property states before modification
   * @param {Object|Object[]} afterStates Property states after modification
   */
  constructor(canvas, objects, beforeStates, afterStates) {
    super();
    this.canvas = canvas;
    this.objects = Array.isArray(objects) ? objects : [objects];
    this.beforeStates = Array.isArray(beforeStates) ? beforeStates : [beforeStates];
    this.afterStates = Array.isArray(afterStates) ? afterStates : [afterStates];
  }

  execute() {
    this.objects.forEach((obj, index) => {
      const state = this.afterStates[index];
      obj.set(state);
      obj.setCoords();
    });
    this.canvas.requestRenderAll();
  }

  undo() {
    this.objects.forEach((obj, index) => {
      const state = this.beforeStates[index];
      obj.set(state);
      obj.setCoords();
    });
    this.canvas.requestRenderAll();
  }
}

/**
 * History Manager - manages Undo/Redo stack using Command Pattern
 */
export class HistoryManager {
  /**
   * @param {number} maxDepth Maximum history states allowed (default: 50)
   */
  constructor(maxDepth = 50) {
    this.maxDepth = maxDepth;
    this.undoStack = [];
    this.redoStack = [];
    this.listeners = new Set();
  }

  /**
   * Register a state change listener
   * @param {Function} callback 
   * @returns {Function} Unregister function
   */
  onStateChange(callback) {
    this.listeners.add(callback);
    // Initial call
    callback({ canUndo: this.canUndo(), canRedo: this.canRedo() });
    return () => this.listeners.delete(callback);
  }

  _notify() {
    const state = {
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    };
    this.listeners.forEach(cb => cb(state));
  }

  /**
   * Execute a command and push to history
   * @param {Command} command 
   */
  execute(command) {
    command.execute();
    this.undoStack.push(command);
    
    // Clear redo stack on new action
    this.redoStack = [];

    // Enforce max history depth
    if (this.undoStack.length > this.maxDepth) {
      this.undoStack.shift();
    }

    this._notify();
  }

  /**
   * Perform Undo
   */
  undo() {
    if (!this.canUndo()) return;
    const command = this.undoStack.pop();
    command.undo();
    this.redoStack.push(command);
    this._notify();
  }

  /**
   * Perform Redo
   */
  redo() {
    if (!this.canRedo()) return;
    const command = this.redoStack.pop();
    command.execute();
    this.undoStack.push(command);
    this._notify();
  }

  /**
   * Check if undo is available
   * @returns {boolean}
   */
  canUndo() {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   * @returns {boolean}
   */
  canRedo() {
    return this.redoStack.length > 0;
  }

  /**
   * Reset the history stacks
   */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this._notify();
  }
}

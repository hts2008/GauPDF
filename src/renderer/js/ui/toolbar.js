/* src/renderer/js/ui/toolbar.js */

import { MODES } from '../../../shared/constants.js';

export class ToolbarController {
  constructor(appInstance) {
    this.appInstance = appInstance;
    this.activeMode = MODES.VIEW;
    this.activeTool = 'select'; // Default tool
    this.init();
  }

  init() {
    // Mode Switch Tab Clicks
    const modeTabs = document.querySelectorAll('.mode-tab');
    modeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const mode = tab.getAttribute('data-mode');
        this.switchMode(mode);
      });
    });

    // Wire individual tool buttons clicks
    this.setupViewTools();
    this.setupEditTools();
    this.setupCommentTools();
    this.setupOrganizeTools();
    this.setupFormsTools();
  }

  switchMode(mode) {
    if (!Object.values(MODES).includes(mode)) return;
    
    this.activeMode = mode;

    // Update Mode Tabs Visual Highlight
    document.querySelectorAll('.mode-tab').forEach(tab => {
      if (tab.getAttribute('data-mode') === mode) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Display correct sub-toolbar
    document.querySelectorAll('.sub-toolbar').forEach(tb => {
      tb.classList.remove('active');
    });

    const targetToolbar = document.getElementById(`toolbar-${mode}`);
    if (targetToolbar) {
      targetToolbar.classList.add('active');
    }

    // Set Default Tool for each mode
    if (mode === MODES.VIEW) this.setTool('select');
    else if (mode === MODES.EDIT) this.setTool('select');
    else if (mode === MODES.COMMENT) this.setTool('highlight');
    else if (mode === MODES.ORGANIZE) this.setTool('organize-select');
    else if (mode === MODES.FORMS) this.setTool('select');

    // Notify main app
    this.appInstance.onModeChanged(mode);
  }

  setTool(toolName) {
    this.activeTool = toolName;
    console.log(`Tool selected: ${toolName} in mode ${this.activeMode}`);

    // Update UI highlights for tool buttons in the current active toolbar
    const currentToolbar = document.getElementById(`toolbar-${this.activeMode}`);
    if (currentToolbar) {
      currentToolbar.querySelectorAll('.btn-icon, .btn-secondary').forEach(btn => {
        const btnId = btn.id || '';
        // If button ID contains the toolName, make it active
        if (btnId.endsWith(toolName)) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    // Notify main app
    this.appInstance.onToolChanged(toolName);
  }

  // --- VIEW MODE TOOLBAR ---
  setupViewTools() {
    const zoomIn = document.getElementById('btn-zoom-in');
    const zoomOut = document.getElementById('btn-zoom-out');
    const zoomInput = document.getElementById('zoom-input');
    const zoomPreset = document.getElementById('select-zoom-preset');
    const layoutSingle = document.getElementById('btn-layout-single');
    const layoutContinuous = document.getElementById('btn-layout-continuous');

    if (zoomIn) {
      zoomIn.addEventListener('click', () => this.appInstance.zoomIn());
    }
    if (zoomOut) {
      zoomOut.addEventListener('click', () => this.appInstance.zoomOut());
    }
    if (zoomInput) {
      zoomInput.addEventListener('change', () => {
        const val = parseFloat(zoomInput.value.replace('%', ''));
        if (!isNaN(val)) {
          this.appInstance.setZoom(val / 100);
        }
      });
    }
    if (zoomPreset) {
      zoomPreset.addEventListener('change', () => {
        const val = zoomPreset.value;
        if (val === 'fit-width' || val === 'fit-page') {
          this.appInstance.setZoom(val);
        } else {
          this.appInstance.setZoom(parseFloat(val));
        }
      });
    }
    if (layoutSingle) {
      layoutSingle.addEventListener('click', () => {
        layoutSingle.classList.add('active');
        layoutContinuous.classList.remove('active');
        this.appInstance.setViewLayout('single');
      });
    }
    if (layoutContinuous) {
      layoutContinuous.addEventListener('click', () => {
        layoutContinuous.classList.add('active');
        layoutSingle.classList.remove('active');
        this.appInstance.setViewLayout('continuous');
      });
    }
  }

  // --- EDIT MODE TOOLBAR ---
  setupEditTools() {
    const selectBtn = document.getElementById('btn-edit-select');
    const textBtn = document.getElementById('btn-edit-text');
    const imgBtn = document.getElementById('btn-edit-image');
    const ocrBtn = document.getElementById('btn-edit-ocr');

    if (selectBtn) selectBtn.addEventListener('click', () => this.setTool('select'));
    if (textBtn) textBtn.addEventListener('click', () => this.setTool('text'));
    if (imgBtn) imgBtn.addEventListener('click', () => this.setTool('image'));
    if (ocrBtn) {
      ocrBtn.addEventListener('click', () => {
        this.appInstance.dialogs.show('ocr');
      });
    }
  }

  // --- COMMENT MODE TOOLBAR ---
  setupCommentTools() {
    const highlight = document.getElementById('btn-comment-highlight');
    const underline = document.getElementById('btn-comment-underline');
    const note = document.getElementById('btn-comment-note');
    const draw = document.getElementById('btn-comment-draw');
    const stamp = document.getElementById('btn-comment-stamp');
    const eraser = document.getElementById('btn-comment-eraser');

    if (highlight) highlight.addEventListener('click', () => this.setTool('highlight'));
    if (underline) underline.addEventListener('click', () => this.setTool('underline'));
    if (note) note.addEventListener('click', () => this.setTool('note'));
    if (draw) draw.addEventListener('click', () => this.setTool('draw'));
    if (stamp) stamp.addEventListener('click', () => this.setTool('stamp'));
    if (eraser) eraser.addEventListener('click', () => this.setTool('eraser'));

    // Stroke Color Picker & Width input
    const colorPicker = document.getElementById('comment-color-picker');
    const strokeWidth = document.getElementById('comment-stroke-width');

    if (colorPicker) {
      colorPicker.addEventListener('change', () => {
        this.appInstance.annotations.setColor(colorPicker.value);
      });
    }
    if (strokeWidth) {
      strokeWidth.addEventListener('input', () => {
        this.appInstance.annotations.setStrokeWidth(parseInt(strokeWidth.value));
      });
    }
  }

  // --- ORGANIZE MODE TOOLBAR ---
  setupOrganizeTools() {
    const rotateLeft = document.getElementById('btn-organize-rotate-left');
    const rotateRight = document.getElementById('btn-organize-rotate-right');
    const deletePage = document.getElementById('btn-organize-delete');
    const insertPage = document.getElementById('btn-organize-insert');
    const mergeBtn = document.getElementById('btn-organize-merge');
    const splitBtn = document.getElementById('btn-organize-split');
    const compressBtn = document.getElementById('btn-organize-compress');

    if (rotateLeft) {
      rotateLeft.addEventListener('click', () => this.appInstance.rotatePage(-90));
    }
    if (rotateRight) {
      rotateRight.addEventListener('click', () => this.appInstance.rotatePage(90));
    }
    if (deletePage) {
      deletePage.addEventListener('click', () => this.appInstance.deleteSelectedPage());
    }
    if (insertPage) {
      insertPage.addEventListener('click', () => this.appInstance.insertBlankPage());
    }
    if (mergeBtn) {
      mergeBtn.addEventListener('click', () => this.appInstance.dialogs.show('merge'));
    }
    if (splitBtn) {
      splitBtn.addEventListener('click', () => this.appInstance.dialogs.show('split'));
    }
    if (compressBtn) {
      compressBtn.addEventListener('click', () => this.appInstance.dialogs.show('compress'));
    }
  }

  // --- FORMS MODE TOOLBAR ---
  setupFormsTools() {
    const select = document.getElementById('btn-forms-select');
    const textfield = document.getElementById('btn-forms-textfield');
    const checkbox = document.getElementById('btn-forms-checkbox');
    const signature = document.getElementById('btn-forms-signature');

    if (select) select.addEventListener('click', () => this.setTool('select'));
    if (textfield) textfield.addEventListener('click', () => this.setTool('textfield'));
    if (checkbox) checkbox.addEventListener('click', () => this.setTool('checkbox'));
    if (signature) {
      signature.addEventListener('click', () => {
        this.appInstance.dialogs.show('signature');
      });
    }
  }
}

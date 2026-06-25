import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { PDFDocument, rgb } from 'pdf-lib';

// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

import { getCanvasPointer } from '../utils/canvas-utils.js';
import { AddObjectCommand, RemoveObjectCommand, ModifyObjectCommand } from './useUndoRedo.js';
import { AnnotationFactory, getArrowPath } from '../features/Annotations.js';

/**
 * Custom React hook for managing PDF rendering and annotation editing layers.
 * 
 * @param {React.RefObject<HTMLDivElement>} containerRef Reference to the container element
 * @param {Object} history History state managed by useUndoRedo hook
 * @param {Object} options Configuration parameters
 */
export function usePDF(containerRef, history, options = {}) {
  const { executeCommand, clearHistory } = history;
  const config = Object.assign({
    defaultScale: 1.0,
    minScale: 0.25,
    maxScale: 5.0,
    scaleStep: 0.15,
    renderInteractiveForms: true
  }, options);

  const [scale, setScale] = useState(config.defaultScale);
  const [rotation, setRotation] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentMode, setCurrentMode] = useState('select'); // select, draw, highlight, text, rect, circle, line, arrow, eraser, note, callout, stamp, textfield, checkbox
  
  const [drawingSettings, setDrawingSettings] = useState({
    strokeColor: '#ff0000',
    fillColor: 'transparent',
    strokeWidth: 3,
    highlightColor: 'rgba(255, 235, 59, 0.45)',
    highlightWidth: 24,
    fontSize: 18,
    fontFamily: 'Arial',
    textColor: '#ff0000',
    stampText: 'APPROVED',
    opacity: 1.0
  });

  const pdfDocRef = useRef(null);
  const pdfLibDocRef = useRef(null);
  const pagesRef = useRef([]); // Stores page wrappers, canvas info, and render tasks
  const canvasesMapRef = useRef(new Map()); // pageNumber -> fabric.Canvas
  const activeDrawingObjectRef = useRef(null);
  
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const objectBeforeStateRef = useRef(null);

  // Initialize PDF container styles
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.style.position = 'relative';
    container.style.overflow = 'auto';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.gap = '20px';
    container.style.padding = '20px';
    container.style.boxSizing = 'border-box';
    container.style.backgroundColor = '#525659';
  }, [containerRef]);

  // Clean up all resources
  const destroyViewer = useCallback(() => {
    pagesRef.current.forEach(page => {
      if (page.renderTask) {
        page.renderTask.cancel();
      }
    });
    canvasesMapRef.current.forEach(canvas => {
      canvas.dispose();
    });
    canvasesMapRef.current.clear();
    pagesRef.current = [];
    pdfDocRef.current = null;
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
  }, [containerRef]);

  useEffect(() => {
    return () => {
      destroyViewer();
    };
  }, [destroyViewer]);

  // Apply current drawing mode configuration to a fabric canvas
  const applyModeToCanvas = useCallback((canvas) => {
    const fabric = window.fabric;
    if (!fabric) return;

    canvas.isDrawingMode = false;
    canvas.selection = currentMode === 'select';

    canvas.forEachObject((obj) => {
      obj.selectable = currentMode === 'select';
      obj.hoverCursor = currentMode === 'select' ? 'move' : 'crosshair';
    });

    if (currentMode === 'draw') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = drawingSettings.strokeColor;
      canvas.freeDrawingBrush.width = drawingSettings.strokeWidth;
    } else if (currentMode === 'highlight') {
      canvas.isDrawingMode = true;
      canvas.freeDrawingBrush.color = drawingSettings.highlightColor;
      canvas.freeDrawingBrush.width = drawingSettings.highlightWidth;
    }

    canvas.defaultCursor = currentMode === 'select' ? 'default' : 'crosshair';
    canvas.requestRenderAll();
  }, [currentMode, drawingSettings]);

  // Synchronize tools to all canvases when mode or settings change
  useEffect(() => {
    canvasesMapRef.current.forEach(canvas => {
      applyModeToCanvas(canvas);
    });
  }, [currentMode, drawingSettings, applyModeToCanvas]);

  // Setup Fabric.js interaction events
  const setupCanvasEvents = useCallback((canvas) => {
    canvas.on('mouse:down', (options) => {
      if (currentMode === 'select') {
        const target = options.target;
        if (target && target.isFormField && target.fieldType === 'checkbox') {
          target.value = !target.value;
          const checkMark = target.item(1);
          if (checkMark) {
            checkMark.set('visible', target.value);
          }
          canvas.requestRenderAll();
          const before = { value: !target.value };
          const after = { value: target.value };
          executeCommand(new ModifyObjectCommand(canvas, target, before, after));
        }
        return;
      }

      if (currentMode === 'draw' || currentMode === 'highlight') return;

      const pointer = getCanvasPointer(canvas, options.e);
      startXRef.current = pointer.x;
      startYRef.current = pointer.y;

      if (currentMode === 'text') {
        const textObj = AnnotationFactory.createText(pointer.x, pointer.y, drawingSettings);
        if (textObj) {
          canvas.add(textObj);
          canvas.setActiveObject(textObj);
          executeCommand(new AddObjectCommand(canvas, textObj));
          textObj.enterEditing();
          textObj.selectAll();
          setCurrentMode('select');
        }
        return;
      }

      if (currentMode === 'note') {
        const noteText = prompt('Enter note content:', 'Note details...');
        if (noteText === null) return;
        const noteObj = AnnotationFactory.createNoteCircle(pointer.x, pointer.y, { ...drawingSettings, noteText });
        if (noteObj) {
          canvas.add(noteObj);
          canvas.setActiveObject(noteObj);
          executeCommand(new AddObjectCommand(canvas, noteObj));
          setCurrentMode('select');
        }
        return;
      }

      if (currentMode === 'callout') {
        const calloutObj = AnnotationFactory.createTextCallout(pointer.x, pointer.y, drawingSettings);
        if (calloutObj) {
          canvas.add(calloutObj);
          canvas.setActiveObject(calloutObj);
          executeCommand(new AddObjectCommand(canvas, calloutObj));
          calloutObj.enterEditing();
          calloutObj.selectAll();
          setCurrentMode('select');
        }
        return;
      }

      if (currentMode === 'stamp') {
        const stampText = drawingSettings.stampText || 'APPROVED';
        const stampObj = AnnotationFactory.createStamp(pointer.x, pointer.y, stampText, drawingSettings);
        if (stampObj) {
          canvas.add(stampObj);
          canvas.setActiveObject(stampObj);
          executeCommand(new AddObjectCommand(canvas, stampObj));
          setCurrentMode('select');
        }
        return;
      }

      if (currentMode === 'textfield') {
        const fieldId = 'TextField_' + Math.random().toString(36).substring(2, 9);
        const textfieldObj = new window.fabric.Textbox('Text Field', {
          left: pointer.x,
          top: pointer.y,
          width: 140,
          fontSize: 12,
          fontFamily: 'Arial',
          backgroundColor: 'rgba(0, 120, 215, 0.1)',
          borderColor: '#0078d7',
          borderScaleFactor: 1,
          hasBorders: true,
          padding: 4,
          isFormField: true,
          fieldType: 'text',
          fieldId: fieldId,
          maxLength: 0,
          required: false,
          value: ''
        });
        canvas.add(textfieldObj);
        canvas.setActiveObject(textfieldObj);
        executeCommand(new AddObjectCommand(canvas, textfieldObj));
        setCurrentMode('select');
        return;
      }

      if (currentMode === 'checkbox') {
        const fieldId = 'Checkbox_' + Math.random().toString(36).substring(2, 9);
        const box = new window.fabric.Rect({
          width: 20,
          height: 20,
          fill: 'rgba(0, 120, 215, 0.1)',
          stroke: '#0078d7',
          strokeWidth: 2,
          rx: 2,
          ry: 2,
          left: 0,
          top: 0
        });
        const check = new window.fabric.Text('✓', {
          fontSize: 16,
          fontWeight: 'bold',
          fill: '#0078d7',
          left: 4,
          top: 0,
          visible: false
        });
        const checkboxObj = new window.fabric.Group([box, check], {
          left: pointer.x,
          top: pointer.y,
          width: 20,
          height: 20,
          selectable: true,
          hasControls: true,
          isFormField: true,
          fieldType: 'checkbox',
          fieldId: fieldId,
          required: false,
          value: false
        });
        canvas.add(checkboxObj);
        canvas.setActiveObject(checkboxObj);
        executeCommand(new AddObjectCommand(canvas, checkboxObj));
        setCurrentMode('select');
        return;
      }

      if (currentMode === 'eraser') {
        if (options.target) {
          executeCommand(new RemoveObjectCommand(canvas, options.target));
          canvas.renderAll();
        }
        return;
      }

      // Handle shapes creation
      let shape = null;
      switch (currentMode) {
        case 'rect':
          shape = AnnotationFactory.createRect(pointer.x, pointer.y, drawingSettings);
          break;
        case 'circle':
          shape = AnnotationFactory.createCircle(pointer.x, pointer.y, drawingSettings);
          break;
        case 'line':
          shape = AnnotationFactory.createLine(pointer.x, pointer.y, drawingSettings);
          break;
        case 'arrow':
          shape = AnnotationFactory.createArrow(pointer.x, pointer.y, drawingSettings);
          break;
      }

      if (shape) {
        activeDrawingObjectRef.current = shape;
        canvas.add(shape);
        canvas.requestRenderAll();
      }
    });

    canvas.on('mouse:move', (options) => {
      if (!activeDrawingObjectRef.current) return;

      const pointer = getCanvasPointer(canvas, options.e);
      const w = pointer.x - startXRef.current;
      const h = pointer.y - startYRef.current;
      const shape = activeDrawingObjectRef.current;

      switch (currentMode) {
        case 'rect':
          shape.set({
            left: w > 0 ? startXRef.current : pointer.x,
            top: h > 0 ? startYRef.current : pointer.y,
            width: Math.abs(w),
            height: Math.abs(h)
          });
          break;
        case 'circle': {
          const radius = Math.sqrt(w * w + h * h) / 2;
          shape.set({
            left: Math.min(startXRef.current, pointer.x),
            top: Math.min(startYRef.current, pointer.y),
            radius: radius
          });
          break;
        }
        case 'line':
          shape.set({
            x2: pointer.x,
            y2: pointer.y
          });
          break;
        case 'arrow': {
          canvas.remove(shape);
          const pathData = getArrowPath(startXRef.current, startYRef.current, pointer.x, pointer.y);
          const newArrow = AnnotationFactory.createArrow(startXRef.current, startYRef.current, drawingSettings);
          newArrow.set({ path: new window.fabric.Path(pathData).path });
          activeDrawingObjectRef.current = newArrow;
          canvas.add(newArrow);
          break;
        }
      }

      canvas.requestRenderAll();
    });

    canvas.on('mouse:up', () => {
      const shape = activeDrawingObjectRef.current;
      if (!shape) return;

      shape.set({
        selectable: true,
        hasControls: true
      });
      shape.setCoords();

      executeCommand(new AddObjectCommand(canvas, shape));
      activeDrawingObjectRef.current = null;
      canvas.requestRenderAll();
    });

    // Property modification tracker
    canvas.on('before:transform', (e) => {
      const obj = e.transform.target;
      if (obj) {
        objectBeforeStateRef.current = {
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

    canvas.on('object:modified', (e) => {
      const obj = e.target;
      if (obj && objectBeforeStateRef.current) {
        const before = objectBeforeStateRef.current;
        const after = {
          left: obj.left,
          top: obj.top,
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          angle: obj.angle,
          skewX: obj.skewX,
          skewY: obj.skewY
        };
        executeCommand(new ModifyObjectCommand(canvas, obj, before, after));
        objectBeforeStateRef.current = null;
      }
    });

    // Text editing tracker
    canvas.on('text:editing:entered', (e) => {
      const obj = e.target;
      if (obj) {
        obj._originalText = obj.text;
      }
    });

    canvas.on('text:editing:exited', (e) => {
      const obj = e.target;
      if (obj && obj._originalText !== obj.text) {
        const before = { text: obj._originalText };
        const after = { text: obj.text };
        executeCommand(new ModifyObjectCommand(canvas, obj, before, after));
      }
    });

    // Freehand drawing tracker
    canvas.on('path:created', (e) => {
      const path = e.path;
      // Register path creation inside history manager stacks
      const command = new AddObjectCommand(canvas, path);
      history.historyManager.undoStack.push(command);
      history.historyManager.redoStack = [];
      history.historyManager._notify();
    });

  }, [currentMode, drawingSettings, executeCommand, history.historyManager]);

  // Global mouseup cleanup
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (activeDrawingObjectRef.current) {
        const canvas = activeDrawingObjectRef.current.canvas;
        if (canvas) {
          activeDrawingObjectRef.current.set({
            selectable: true,
            hasControls: true
          });
          activeDrawingObjectRef.current.setCoords();
          executeCommand(new AddObjectCommand(canvas, activeDrawingObjectRef.current));
          activeDrawingObjectRef.current = null;
          canvas.requestRenderAll();
        }
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [executeCommand]);

  // Load and render existing PDF AcroForms using pdf-lib on a canvas
  const loadAcroFormsForPage = useCallback((canvas, pageNumber) => {
    if (!pdfLibDocRef.current) return;
    try {
      const form = pdfLibDocRef.current.getForm();
      const fields = form.getFields();
      const pages = pdfLibDocRef.current.getPages();
      const targetPage = pages[pageNumber - 1];
      if (!targetPage) return;
      const { height: pageHeight } = targetPage.getSize();

      fields.forEach(field => {
        const widgets = field.acroField.getWidgets();
        widgets.forEach(widget => {
          let isOnPage = false;
          const pageRef = widget.getOnPage();
          if (pageRef) {
            isOnPage = (pageRef === targetPage.ref || pageRef.num === targetPage.ref.num);
          } else {
            const annots = targetPage.node.Annots();
            if (annots) {
              for (let j = 0; j < annots.size(); j++) {
                if (annots.get(j) === widget.ref) {
                  isOnPage = true;
                  break;
                }
              }
            }
          }

          if (!isOnPage) return;

          const rect = widget.getRectangle();
          if (!rect) return;

          // Convert PDF coordinates to Fabric coordinates
          const zoom = canvas.getZoom() || 1.0;
          const left = rect.x * zoom;
          const top = (pageHeight - rect.y - rect.height) * zoom;
          const width = rect.width * zoom;
          const height = rect.height * zoom;

          const fieldName = field.getName();
          const required = field.isRequired();
          let value = '';
          try {
            value = typeof field.getText === 'function' ? field.getText() : (typeof field.isChecked === 'function' ? field.isChecked() : '');
          } catch (e) {}

          const fabric = window.fabric;
          if (!fabric) return;

          let fabricFieldObj = null;
          const isText = typeof field.getText === 'function';
          const isCheckbox = typeof field.isChecked === 'function';

          if (isText) {
            let maxLength = 0;
            try {
              maxLength = field.getMaxLength() || 0;
            } catch (e) {}

            fabricFieldObj = new fabric.Textbox(value || '', {
              left,
              top,
              width,
              height,
              fontSize: 12,
              fontFamily: 'Arial',
              backgroundColor: 'rgba(0, 120, 215, 0.1)',
              borderColor: '#0078d7',
              borderScaleFactor: 1,
              hasBorders: true,
              padding: 4,
              isFormField: true,
              fieldType: 'text',
              fieldId: fieldName,
              maxLength,
              required,
              value: value || ''
            });
          } else if (isCheckbox) {
            const box = new fabric.Rect({
              width: 20,
              height: 20,
              fill: 'rgba(0, 120, 215, 0.1)',
              stroke: '#0078d7',
              strokeWidth: 2,
              rx: 2,
              ry: 2,
              left: 0,
              top: 0
            });
            const check = new fabric.Text('✓', {
              fontSize: 16,
              fontWeight: 'bold',
              fill: '#0078d7',
              left: 4,
              top: 0,
              visible: !!value
            });
            fabricFieldObj = new fabric.Group([box, check], {
              left,
              top,
              width: 20,
              height: 20,
              selectable: true,
              hasControls: true,
              isFormField: true,
              fieldType: 'checkbox',
              fieldId: fieldName,
              required,
              value: !!value
            });
          }

          if (fabricFieldObj) {
            canvas.add(fabricFieldObj);
          }
        });
      });
      canvas.requestRenderAll();
    } catch (err) {
      console.error("Error loading AcroForms for page:", err);
    }
  }, []);

  // Render a specific page
  const renderPage = useCallback(async (pageNumber, currentScale, currentRotation) => {
    const pageData = pagesRef.current.find(p => p.pageNumber === pageNumber);
    if (!pageData || !pdfDocRef.current) return;

    try {
      if (pageData.renderTask) {
        pageData.renderTask.cancel();
        pageData.renderTask = null;
      }

      if (!pageData.pdfPage) {
        pageData.pdfPage = await pdfDocRef.current.getPage(pageNumber);
      }

      const page = pageData.pdfPage;
      const viewport = page.getViewport({ scale: currentScale, rotation: currentRotation });

      const width = viewport.width;
      const height = viewport.height;

      pageData.wrapper.style.width = `${width}px`;
      pageData.wrapper.style.height = `${height}px`;

      const pdfCanvas = pageData.pdfCanvas;
      const context = pdfCanvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      
      pdfCanvas.width = width * dpr;
      pdfCanvas.height = height * dpr;
      pdfCanvas.style.width = `${width}px`;
      pdfCanvas.style.height = `${height}px`;
      context.scale(dpr, dpr);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        enableWebGL: true,
        renderInteractiveForms: config.renderInteractiveForms
      };

      pageData.renderTask = page.render(renderContext);
      await pageData.renderTask.promise;
      pageData.renderTask = null;

      // Handle Fabric Canvas Overlay Setup
      const fabric = window.fabric;
      if (fabric) {
        let fabricCanvas = canvasesMapRef.current.get(pageNumber);
        if (!fabricCanvas) {
          pageData.annotationCanvas.style.pointerEvents = 'auto';
          fabricCanvas = new fabric.Canvas(pageData.annotationCanvas, {
            width: width,
            height: height,
            selection: true,
            preserveObjectStacking: true
          });
          canvasesMapRef.current.set(pageNumber, fabricCanvas);
          setupCanvasEvents(fabricCanvas);
          loadAcroFormsForPage(fabricCanvas, pageNumber);
        } else {
          fabricCanvas.setDimensions({ width, height });
          fabricCanvas.setZoom(currentScale);
          fabricCanvas.requestRenderAll();
        }
        applyModeToCanvas(fabricCanvas);
      }

    } catch (err) {
      if (err.name === 'RenderingCancelledException' || err.message?.includes('cancelled')) {
        return;
      }
      console.error(`Error rendering page ${pageNumber}:`, err);
    }
  }, [config.renderInteractiveForms, applyModeToCanvas, setupCanvasEvents, loadAcroFormsForPage]);

  // Re-render pages when scale or rotation changes
  useEffect(() => {
    if (!pdfDocRef.current) return;
    const renderAll = async () => {
      for (const pageData of pagesRef.current) {
        await renderPage(pageData.pageNumber, scale, rotation);
      }
    };
    renderAll();
  }, [scale, rotation, renderPage]);

  // Document loader
  const loadPDF = async (src) => {
    setLoading(true);
    try {
      destroyViewer();

      let pdfBytes;
      if (src instanceof ArrayBuffer) {
        pdfBytes = new Uint8Array(src);
      } else if (ArrayBuffer.isView(src)) {
        pdfBytes = new Uint8Array(src.buffer, src.byteOffset, src.byteLength);
      } else {
        const response = await fetch(src);
        pdfBytes = new Uint8Array(await response.arrayBuffer());
      }
      pdfBytesRef.current = pdfBytes;
      pdfLibDocRef.current = await PDFDocument.load(pdfBytes);

      const loadingTask = pdfjsLib.getDocument({
        data: pdfBytes,
        cMapUrl: 'node_modules/pdfjs-dist/cmaps/',
        cMapPacked: true,
      });

      const doc = await loadingTask.promise;
      pdfDocRef.current = doc;
      setNumPages(doc.numPages);
      setCurrentPage(1);

      const container = containerRef.current;
      if (!container) return;

      container.innerHTML = '';
      pagesRef.current = [];

      for (let i = 1; i <= doc.numPages; i++) {
        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'pdf-page-wrapper';
        pageWrapper.dataset.pageNumber = i;
        pageWrapper.style.position = 'relative';
        pageWrapper.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
        pageWrapper.style.backgroundColor = '#ffffff';
        pageWrapper.style.boxSizing = 'border-box';
        
        const pdfCanvas = document.createElement('canvas');
        pdfCanvas.className = 'pdf-canvas';
        pdfCanvas.style.display = 'block';
        pageWrapper.appendChild(pdfCanvas);

        const annotationCanvas = document.createElement('canvas');
        annotationCanvas.className = 'annotation-canvas';
        annotationCanvas.style.position = 'absolute';
        annotationCanvas.style.top = '0';
        annotationCanvas.style.left = '0';
        annotationCanvas.style.pointerEvents = 'none';
        pageWrapper.appendChild(annotationCanvas);

        container.appendChild(pageWrapper);

        pagesRef.current.push({
          pageNumber: i,
          wrapper: pageWrapper,
          pdfCanvas,
          annotationCanvas,
          renderTask: null,
          pdfPage: null
        });
      }

      // Sequentially render all pages
      for (const pageData of pagesRef.current) {
        await renderPage(pageData.pageNumber, scale, rotation);
      }

    } catch (err) {
      console.error('Error loading PDF document:', err);
    } finally {
      setLoading(false);
    }
  };

  // Scroll tracker using IntersectionObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container || pagesRef.current.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.dataset.pageNumber, 10);
            if (!isNaN(pageNum)) {
              setCurrentPage(pageNum);
            }
          }
        });
      },
      {
        root: container,
        threshold: 0.5
      }
    );

    pagesRef.current.forEach(page => {
      observer.observe(page.wrapper);
    });

    return () => {
      observer.disconnect();
    };
  }, [loading, numPages, containerRef]);

  // Zooming helpers
  const zoomIn = () => {
    setScale(prev => Math.min(config.maxScale, prev + config.scaleStep));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(config.minScale, prev - config.scaleStep));
  };

  const zoomToWidth = () => {
    if (pagesRef.current.length === 0) return;
    const firstPage = pagesRef.current[0];
    if (!firstPage.pdfPage) return;

    const viewport = firstPage.pdfPage.getViewport({ scale: 1, rotation });
    const containerWidth = containerRef.current.clientWidth - 60;
    const newScale = containerWidth / viewport.width;
    setScale(Math.max(config.minScale, Math.min(config.maxScale, newScale)));
  };

  const zoomToFit = () => {
    if (pagesRef.current.length === 0) return;
    const firstPage = pagesRef.current[0];
    if (!firstPage.pdfPage) return;

    const viewport = firstPage.pdfPage.getViewport({ scale: 1, rotation });
    const containerWidth = containerRef.current.clientWidth - 60;
    const containerHeight = containerRef.current.clientHeight - 60;

    const scaleWidth = containerWidth / viewport.width;
    const scaleHeight = containerHeight / viewport.height;
    const newScale = Math.min(scaleWidth, scaleHeight);
    
    setScale(Math.max(config.minScale, Math.min(config.maxScale, newScale)));
  };

  // Rotating helpers
  const rotateClockwise = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const rotateCounterClockwise = () => {
    setRotation(prev => (prev - 90 + 360) % 360);
  };

  // Settings modifier
  const updateDrawingSettings = (newSettings) => {
    setDrawingSettings(prev => {
      const updated = { ...prev, ...newSettings };
      
      canvasesMapRef.current.forEach(canvas => {
        if (canvas.isDrawingMode && canvas.freeDrawingBrush) {
          if (currentMode === 'draw') {
            canvas.freeDrawingBrush.color = updated.strokeColor;
            canvas.freeDrawingBrush.width = updated.strokeWidth;
          } else if (currentMode === 'highlight') {
            canvas.freeDrawingBrush.color = updated.highlightColor;
            canvas.freeDrawingBrush.width = updated.highlightWidth;
          }
        }

        const activeObj = canvas.getActiveObject();
        if (activeObj) {
          const before = {};
          const after = {};
          let modified = false;

          // Helper to record before/after states for undo history
          const setProp = (propName, newVal) => {
            if (newVal !== undefined && activeObj.get(propName) !== newVal) {
              before[propName] = activeObj.get(propName);
              activeObj.set(propName, newVal);
              after[propName] = newVal;
              modified = true;
            }
          };

          // Apply styling properties
          if (activeObj.type === 'i-text' || activeObj.type === 'textbox' || activeObj.isTextCallout) {
            if (newSettings.textColor) setProp('fill', newSettings.textColor);
            if (newSettings.fontSize) setProp('fontSize', newSettings.fontSize);
            if (newSettings.fontFamily) setProp('fontFamily', newSettings.fontFamily);
            if (newSettings.fontWeight) setProp('fontWeight', newSettings.fontWeight);
            if (newSettings.fontStyle) setProp('fontStyle', newSettings.fontStyle);
            if (newSettings.underline !== undefined) setProp('underline', newSettings.underline);
            if (newSettings.fillColor && activeObj.isTextCallout) setProp('backgroundColor', newSettings.fillColor);
            if (newSettings.strokeColor && activeObj.isTextCallout) setProp('stroke', newSettings.strokeColor);
            if (newSettings.strokeWidth && activeObj.isTextCallout) setProp('strokeWidth', newSettings.strokeWidth);
          } else {
            if (newSettings.strokeColor) setProp('stroke', newSettings.strokeColor);
            if (newSettings.fillColor) setProp('fill', newSettings.fillColor);
            if (newSettings.strokeWidth) setProp('strokeWidth', newSettings.strokeWidth);
          }

          if (newSettings.opacity !== undefined) {
            setProp('opacity', newSettings.opacity);
          }

          // Custom stamp text updates
          if (activeObj.isStamp && newSettings.stampText) {
            before.stampText = activeObj.stampText;
            activeObj.stampText = newSettings.stampText;
            after.stampText = newSettings.stampText;
            const stampTextObj = activeObj.item(1);
            if (stampTextObj) {
              before.text = stampTextObj.text;
              stampTextObj.set('text', newSettings.stampText.toUpperCase());
              after.text = newSettings.stampText.toUpperCase();
            }
            modified = true;
          }

          // Custom note text updates
          if (activeObj.isNoteCircle && newSettings.noteText) {
            before.noteText = activeObj.noteText;
            activeObj.noteText = newSettings.noteText;
            after.noteText = newSettings.noteText;
            modified = true;
          }

          // Form field updates
          if (activeObj.isFormField) {
            if (newSettings.fieldId) {
              before.fieldId = activeObj.fieldId;
              activeObj.fieldId = newSettings.fieldId;
              after.fieldId = newSettings.fieldId;
              modified = true;
            }
            if (newSettings.required !== undefined) {
              before.required = activeObj.required;
              activeObj.required = newSettings.required;
              after.required = newSettings.required;
              modified = true;
            }
            if (newSettings.maxLength !== undefined && activeObj.fieldType === 'text') {
              before.maxLength = activeObj.maxLength;
              activeObj.maxLength = newSettings.maxLength;
              after.maxLength = newSettings.maxLength;
              modified = true;
            }
            if (newSettings.value !== undefined) {
              before.value = activeObj.value;
              activeObj.value = newSettings.value;
              after.value = newSettings.value;
              
              if (activeObj.fieldType === 'checkbox') {
                const checkMark = activeObj.item(1);
                if (checkMark) checkMark.set('visible', !!newSettings.value);
              } else if (activeObj.fieldType === 'text') {
                activeObj.set('text', newSettings.value);
              }
              modified = true;
            }
          }

          if (modified) {
            executeCommand(new ModifyObjectCommand(canvas, activeObj, before, after));
            canvas.requestRenderAll();
          }
        }
      });

      return updated;
    };
  };

  // Annotations controls
  const deleteSelected = () => {
    canvasesMapRef.current.forEach(canvas => {
      const activeObjects = canvas.getActiveObjects();
      if (activeObjects.length > 0) {
        executeCommand(new RemoveObjectCommand(canvas, activeObjects));
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }
    });
  };

  const exportAnnotations = () => {
    const data = [];
    canvasesMapRef.current.forEach((canvas, pageNum) => {
      const json = canvas.toJSON(['isNoteCircle', 'noteText', 'isTextCallout', 'isStamp', 'stampText', 'isFormField', 'fieldType', 'fieldId', 'maxLength', 'required', 'value']);
      data.push({
        pageNumber: pageNum,
        annotations: json.objects
      });
    });
    return data;
  };

  const importAnnotations = (annotationsList) => {
    if (!Array.isArray(annotationsList)) return;
    
    annotationsList.forEach(item => {
      const canvas = canvasesMapRef.current.get(item.pageNumber);
      if (canvas && Array.isArray(item.annotations)) {
        canvas.clear();
        
        window.fabric.util.enlivenObjects(item.annotations, (enlivedObjects) => {
          enlivedObjects.forEach(obj => {
            canvas.add(obj);
          });
          canvas.requestRenderAll();
        });
      }
    });
    clearHistory();
  };

  const clearAnnotations = () => {
    canvasesMapRef.current.forEach(canvas => {
      canvas.clear();
      canvas.requestRenderAll();
    });
    clearHistory();
  };

  // Compile Fabric form fields and return modified PDF Uint8Array bytes using pdf-lib
  const compilePDF = async () => {
    if (!pdfLibDocRef.current) return null;
    try {
      const form = pdfLibDocRef.current.getForm();
      const pages = pdfLibDocRef.current.getPages();

      // Synchronize deletion: remove form fields that are no longer present on any canvas
      const activeFieldIds = new Set();
      canvasesMapRef.current.forEach(canvas => {
        canvas.getObjects().forEach(obj => {
          if (obj.isFormField) {
            activeFieldIds.add(obj.fieldId);
          }
        });
      });

      const fields = form.getFields();
      fields.forEach(field => {
        const name = field.getName();
        if (!activeFieldIds.has(name)) {
          try {
            form.removeField(field);
          } catch (e) {
            console.warn(`Could not remove field ${name}:`, e);
          }
        }
      });

      // Update or create form fields on their respective pages
      for (const [pageNum, canvas] of canvasesMapRef.current.entries()) {
        const page = pages[pageNum - 1];
        if (!page) continue;
        const { height: pageHeight } = page.getSize();
        const zoom = canvas.getZoom() || 1.0;
        const objects = canvas.getObjects();

        for (const obj of objects) {
          if (obj.isFormField) {
            const x = obj.left / zoom;
            const y = pageHeight - (obj.top / zoom) - ((obj.height * obj.scaleY) / zoom);
            const w = (obj.width * obj.scaleX) / zoom;
            const h = (obj.height * obj.scaleY) / zoom;

            if (obj.fieldType === 'text') {
              let textField;
              try {
                textField = form.getTextField(obj.fieldId);
              } catch (e) {
                textField = form.createTextField(obj.fieldId);
              }
              textField.setText(obj.text || obj.value || '');
              if (obj.maxLength > 0) {
                textField.setMaxLength(obj.maxLength);
              }
              textField.setRequired(!!obj.required);
              
              try {
                textField.acroField.getWidgets().forEach(w => textField.acroField.removeWidget(w));
                textField.addToPage(page, { x, y, width: w, height: h });
              } catch (err) {
                try {
                  textField.addToPage(page, { x, y, width: w, height: h });
                } catch (e2) {}
              }
            } else if (obj.fieldType === 'checkbox') {
              let checkBox;
              try {
                checkBox = form.getCheckBox(obj.fieldId);
              } catch (e) {
                checkBox = form.createCheckBox(obj.fieldId);
              }
              if (obj.value) {
                checkBox.check();
              } else {
                checkBox.uncheck();
              }
              checkBox.setRequired(!!obj.required);

              try {
                checkBox.acroField.getWidgets().forEach(w => checkBox.acroField.removeWidget(w));
                checkBox.addToPage(page, { x, y, width: w, height: h });
              } catch (err) {
                try {
                  checkBox.addToPage(page, { x, y, width: w, height: h });
                } catch (e2) {}
              }
            }
          }
        }
      }

      const pdfBytes = await pdfLibDocRef.current.save();
      return pdfBytes;
    } catch (err) {
      console.error("Error compiling PDF form fields:", err);
      return null;
    }
  };

  return {
    scale,
    rotation,
    currentPage,
    numPages,
    loading,
    currentMode,
    drawingSettings,
    loadPDF,
    zoomIn,
    zoomOut,
    zoomToWidth,
    zoomToFit,
    rotateClockwise,
    rotateCounterClockwise,
    setMode: setCurrentMode,
    updateDrawingSettings,
    deleteSelected,
    exportAnnotations,
    importAnnotations,
    clearAnnotations,
    compilePDF,
    fabricCanvases: canvasesMapRef.current
  };
}

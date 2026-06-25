import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

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
  const [currentMode, setCurrentMode] = useState('select'); // select, draw, highlight, text, rect, circle, line, arrow, eraser
  
  const [drawingSettings, setDrawingSettings] = useState({
    strokeColor: '#ff0000',
    fillColor: 'transparent',
    strokeWidth: 3,
    highlightColor: 'rgba(255, 235, 59, 0.45)',
    highlightWidth: 24,
    fontSize: 18,
    fontFamily: 'Arial',
    textColor: '#ff0000'
  });

  const pdfDocRef = useRef(null);
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
      if (currentMode === 'select' || currentMode === 'draw' || currentMode === 'highlight') return;

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
  }, [config.renderInteractiveForms, applyModeToCanvas, setupCanvasEvents]);

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

      let loadingTask;
      if (src instanceof ArrayBuffer || ArrayBuffer.isView(src)) {
        loadingTask = pdfjsLib.getDocument({
          data: src,
          cMapUrl: 'node_modules/pdfjs-dist/cmaps/',
          cMapPacked: true,
        });
      } else {
        loadingTask = pdfjsLib.getDocument({
          url: src,
          cMapUrl: 'node_modules/pdfjs-dist/cmaps/',
          cMapPacked: true,
        });
      }

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

          if (activeObj.type === 'i-text') {
            if (newSettings.textColor) {
              before.fill = activeObj.fill;
              activeObj.set('fill', newSettings.textColor);
              after.fill = newSettings.textColor;
              modified = true;
            }
            if (newSettings.fontSize) {
              before.fontSize = activeObj.fontSize;
              activeObj.set('fontSize', newSettings.fontSize);
              after.fontSize = newSettings.fontSize;
              modified = true;
            }
            if (newSettings.fontFamily) {
              before.fontFamily = activeObj.fontFamily;
              activeObj.set('fontFamily', newSettings.fontFamily);
              after.fontFamily = newSettings.fontFamily;
              modified = true;
            }
          } else {
            if (newSettings.strokeColor) {
              before.stroke = activeObj.stroke;
              activeObj.set('stroke', newSettings.strokeColor);
              after.stroke = newSettings.strokeColor;
              modified = true;
            }
            if (newSettings.fillColor) {
              before.fill = activeObj.fill;
              activeObj.set('fill', newSettings.fillColor);
              after.fill = newSettings.fillColor;
              modified = true;
            }
            if (newSettings.strokeWidth) {
              before.strokeWidth = activeObj.strokeWidth;
              activeObj.set('strokeWidth', newSettings.strokeWidth);
              after.strokeWidth = newSettings.strokeWidth;
              modified = true;
            }
          }

          if (modified) {
            executeCommand(new ModifyObjectCommand(canvas, activeObj, before, after));
          }
        }
      });

      return updated;
    });
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
      const json = canvas.toJSON();
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
    fabricCanvases: canvasesMapRef.current
  };
}

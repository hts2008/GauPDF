import React, { useRef, useEffect, useState } from 'react';
import { AnnotationFactory } from '../features/Annotations.js';


// Individual Page Container Component
function PageContainer({
  pageNum,
  pdfDoc,
  zoom,
  activeMode,
  activeTool,
  setActiveTool,
  commentColor,
  strokeWidth,
  savedSignatureDataUrl,
  onObjectSelected,
  onAddFormField,
  formFields,
  onFormFieldClick,
  onUpdateFormFieldValue,
  registerFabricInstance,
  unregisterFabricInstance
}) {
  const containerRef = useRef(null);
  const pdfCanvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const [size, setSize] = useState({ width: 595, height: 842 });
  const fabricInstanceRef = useRef(null);

  // Render PDF.js page content
  useEffect(() => {
    let active = true;
    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: zoom });
        
        if (!active) return;
        setSize({ width: viewport.width, height: viewport.height });

        // Small delay to ensure React state updates size of container before rendering
        setTimeout(async () => {
          if (!active) return;
          const canvas = pdfCanvasRef.current;
          if (!canvas) return;
          const context = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          const renderContext = {
            canvasContext: context,
            viewport: viewport
          };
          await page.render(renderContext).promise;
        }, 50);

      } catch (err) {
        console.error(`Error rendering PDF page ${pageNum}:`, err);
      }
    };

    renderPage();
    return () => {
      active = false;
    };
  }, [pdfDoc, pageNum, zoom]);

  // Set up Fabric.js overlay canvas
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Create Fabric instance on top of PDF canvas
    const fCanvas = new window.fabric.Canvas(canvas, {
      width: size.width,
      height: size.height
    });

    fabricInstanceRef.current = fCanvas;
    registerFabricInstance(pageNum, fCanvas);

    // Setup interactive configurations
    fCanvas.selection = true;
    fCanvas.isDrawingMode = false;

    // Helper to extract properties for selected Fabric objects
    const handleSelection = (obj) => {
      if (!obj) {
        onObjectSelected(null);
        return;
      }
      
      let type = 'unknown';
      if (obj.isFormField) type = 'form-field';
      else if (obj.isNoteCircle) type = 'note-circle';
      else if (obj.isTextCallout) type = 'text-callout';
      else if (obj.isStamp) type = 'stamp';
      else if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') type = 'text';
      else if (obj.type === 'path') type = 'drawing';

      onObjectSelected({
        type,
        ref: obj,
        text: obj.text || '',
        fill: obj.fill || '',
        backgroundColor: obj.backgroundColor || '',
        stroke: obj.stroke || '',
        strokeWidth: obj.strokeWidth || 0,
        fontSize: obj.fontSize || 0,
        fontFamily: obj.fontFamily || '',
        fontWeight: obj.fontWeight || 'normal',
        fontStyle: obj.fontStyle || 'normal',
        underline: !!obj.underline,
        opacity: obj.opacity !== undefined ? obj.opacity : 1.0,
        angle: obj.angle || 0,
        
        // custom attributes
        noteText: obj.noteText || '',
        stampText: obj.stampText || '',
        fieldId: obj.fieldId || '',
        fieldType: obj.fieldType || '',
        maxLength: obj.maxLength || 0,
        required: !!obj.required,
        value: obj.value !== undefined ? obj.value : ''
      });
    };

    fCanvas.on('selection:created', (e) => handleSelection(e.selected[0]));
    fCanvas.on('selection:updated', (e) => handleSelection(e.selected[0]));
    fCanvas.on('selection:cleared', () => handleSelection(null));

    // Clicking on canvas to place stamps, text boxes, and signature images
    fCanvas.on('mouse:down', (options) => {
      if (activeTool === 'select') {
        const target = options.target;
        if (target && target.isFormField && target.fieldType === 'checkbox') {
          target.value = !target.value;
          const checkMark = target.item(1);
          if (checkMark) {
            checkMark.set('visible', target.value);
          }
          fCanvas.requestRenderAll();
          handleSelection(target);
        }
        return;
      }

      const pointer = fCanvas.getPointer(options.e);

      if (activeTool === 'text') {
        const text = AnnotationFactory.createText(pointer.x, pointer.y, { textColor: commentColor });
        if (text) {
          fCanvas.add(text);
          fCanvas.setActiveObject(text);
          text.enterEditing();
          fCanvas.renderAll();
          setActiveTool('select');
        }
      } else if (activeTool === 'stamp') {
        const stamp = AnnotationFactory.createStamp(pointer.x, pointer.y, 'APPROVED', { opacity: 1.0 });
        if (stamp) {
          fCanvas.add(stamp);
          fCanvas.setActiveObject(stamp);
          fCanvas.renderAll();
          setActiveTool('select');
        }
      } else if (activeTool === 'note') {
        const txt = prompt('Enter note content:', 'Note details...');
        if (txt !== null) {
          const noteCircle = AnnotationFactory.createNoteCircle(pointer.x, pointer.y, { noteText: txt });
          if (noteCircle) {
            fCanvas.add(noteCircle);
            fCanvas.setActiveObject(noteCircle);
            fCanvas.renderAll();
            setActiveTool('select');
          }
        }
      } else if (activeTool === 'eraser') {
        if (options.target) {
          fCanvas.remove(options.target);
          fCanvas.renderAll();
        }
      } else if (activeTool === 'signature' && savedSignatureDataUrl) {
        window.fabric.Image.fromURL(savedSignatureDataUrl, (img) => {
          img.set({
            left: pointer.x - 100,
            top: pointer.y - 50,
            scaleX: 0.5,
            scaleY: 0.5,
            selectable: true,
            cornerColor: '#6366f1',
            cornerSize: 8,
            transparentCorners: false
          });
          fCanvas.add(img);
          fCanvas.setActiveObject(img);
          fCanvas.renderAll();
          setActiveTool('select');
        });
      } else if (activeTool === 'textfield') {
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
        fCanvas.add(textfieldObj);
        fCanvas.setActiveObject(textfieldObj);
        fCanvas.renderAll();
        setActiveTool('select');
      } else if (activeTool === 'checkbox') {
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
        fCanvas.add(checkboxObj);
        fCanvas.setActiveObject(checkboxObj);
        fCanvas.renderAll();
        setActiveTool('select');
      }
    });

    const loadAcroForms = async () => {
      if (!window.api || !activeTab || !activeTab.filePath) return;
      try {
        const { PDFDocument } = await import('pdf-lib');
        const rawBytes = await window.api.invoke('file:read', activeTab.filePath);
        if (!rawBytes) return;
        const pdfLibDoc = await PDFDocument.load(rawBytes);
        const form = pdfLibDoc.getForm();
        const fields = form.getFields();
        const pages = pdfLibDoc.getPages();
        const targetPage = pages[pageNum - 1];
        if (!targetPage) return;
        const { height: pageHeight } = targetPage.getSize();

        fields.forEach(field => {
          const widgets = field.acroField.getWidgets();
          widgets.forEach(widget => {
            let isOnPage = false;
            const pageRef = widget.getOnPage();
            if (pageRef) {
              isOnPage = (pageRef.num === targetPage.ref.num);
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

            const left = rect.x;
            const top = pageHeight - rect.y - rect.height;
            const width = rect.width;
            const height = rect.height;

            const fieldName = field.getName();
            const required = field.isRequired();
            let value = '';
            try {
              value = typeof field.getText === 'function' ? field.getText() : (typeof field.isChecked === 'function' ? field.isChecked() : '');
            } catch (e) {}

            let fabricFieldObj = null;
            const isText = typeof field.getText === 'function';
            const isCheckbox = typeof field.isChecked === 'function';

            if (isText) {
              let maxLength = 0;
              try {
                maxLength = field.getMaxLength() || 0;
              } catch (e) {}

              fabricFieldObj = new window.fabric.Textbox(value || '', {
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
                visible: !!value
              });
              fabricFieldObj = new window.fabric.Group([box, check], {
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
              const existingObjects = fCanvas.getObjects();
              const alreadyExists = existingObjects.some(o => o.isFormField && o.fieldId === fieldName);
              if (!alreadyExists) {
                fCanvas.add(fabricFieldObj);
              }
            }
          });
        });
        fCanvas.requestRenderAll();
      } catch (err) {
        console.error("Error loading AcroForms for page overlay:", err);
      }
    };

    loadAcroForms();

    return () => {
      fCanvas.dispose();
      unregisterFabricInstance(pageNum);
    };
  }, [pageNum, size, activeTool, commentColor, savedSignatureDataUrl, activeTab]);

  // Synchronize tools selection changes
  useEffect(() => {
    const fCanvas = fabricInstanceRef.current;
    if (!fCanvas) return;

    fCanvas.isDrawingMode = false;
    if (activeTool === 'draw') {
      fCanvas.isDrawingMode = true;
      fCanvas.freeDrawingBrush.color = commentColor;
      fCanvas.freeDrawingBrush.width = strokeWidth;
    } else if (activeTool === 'highlight') {
      fCanvas.isDrawingMode = true;
      fCanvas.freeDrawingBrush.color = 'rgba(255, 235, 59, 0.45)';
      fCanvas.freeDrawingBrush.width = 24;
    } else if (activeTool === 'underline') {
      fCanvas.isDrawingMode = true;
      fCanvas.freeDrawingBrush.color = 'rgba(79, 70, 229, 0.6)';
      fCanvas.freeDrawingBrush.width = 6;
    }

    if (activeTool === 'select') {
      fCanvas.forEachObject(obj => {
        obj.selectable = true;
        obj.evented = true;
      });
    } else if (['text', 'stamp', 'note', 'eraser', 'signature', 'textfield', 'checkbox'].includes(activeTool)) {
      fCanvas.forEachObject(obj => {
        obj.selectable = false;
        obj.evented = true;
      });
    }
  }, [activeTool, commentColor, strokeWidth]);

  return (
    <div
      ref={containerRef}
      className="pdf-page-container"
      id={`page-container-${pageNum}`}
      style={{ width: `${size.width}px`, height: `${size.height}px` }}
    >
      <div className="page-flag">Page {pageNum}</div>
      <canvas ref={pdfCanvasRef} className="pdf-canvas" />
      <canvas ref={fabricCanvasRef} className="canvas-container" style={{ position: 'absolute', top: 0, left: 0 }} />

      {/* Form Fields overlays */}
      {formFields
        .filter((field) => field.pageNum === pageNum)
        .map((field) => (
          <div
            key={field.id}
            className="form-field-overlay"
            style={{
              position: 'absolute',
              left: `${field.x}px`,
              top: `${field.y}px`,
              width: `${field.width}px`,
              height: `${field.height}px`,
              zIndex: 10
            }}
            onClick={(e) => {
              e.stopPropagation();
              onFormFieldClick(field, e.currentTarget);
            }}
          >
            {field.type === 'text' ? (
              <input
                type="text"
                value={field.value || ''}
                placeholder="Type here..."
                onChange={(e) => onUpdateFormFieldValue(field.id, e.target.value)}
                style={{ width: '100%', height: '100%', border: 'none', background: 'transparent', outline: 'none', padding: '0 4px', fontSize: '11px', color: '#000000' }}
              />
            ) : (
              <input
                type="checkbox"
                checked={!!field.value}
                onChange={(e) => onUpdateFormFieldValue(field.id, e.target.checked)}
                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
              />
            )}
          </div>
        ))}
    </div>
  );
}

export default function Viewer({
  activeTab,
  activeMode,
  activeTool,
  setActiveTool,
  commentColor,
  strokeWidth,
  savedSignatureDataUrl,
  setSelectedObject,
  formFields,
  onAddFormField,
  onFormFieldClick,
  onUpdateFormFieldValue,
  registerFabricInstance,
  unregisterFabricInstance,
  onViewportScroll
}) {
  const viewportRef = useRef(null);

  // Monitor scroll to update active page number indicator in status bar
  const handleScroll = () => {
    if (!viewportRef.current || !activeTab) return;
    const viewport = viewportRef.current;
    const containers = viewport.querySelectorAll('.pdf-page-container');
    
    let activePage = 1;
    let minDistance = Infinity;

    containers.forEach((container) => {
      const rect = container.getBoundingClientRect();
      const distance = Math.abs(rect.top - viewport.getBoundingClientRect().top);
      if (distance < minDistance) {
        minDistance = distance;
        activePage = parseInt(container.id.replace('page-container-', ''), 10);
      }
    });

    onViewportScroll(activePage);
  };

  if (!activeTab || !activeTab.pdfDoc) {
    return (
      <section id="workspace-container">
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justify: 'center', color: 'var(--text-muted)' }}>
          No document loaded.
        </div>
      </section>
    );
  }

  const pdfDoc = activeTab.pdfDoc;
  const numPages = pdfDoc.numPages;
  const pagesArray = Array.from({ length: numPages }, (_, i) => i + 1);

  return (
    <section id="workspace-container">
      <div id="document-workspace">
        <div ref={viewportRef} id="document-viewport" onScroll={handleScroll}>
          {pagesArray
            .filter((pageNum) => activeTab.layout === 'continuous' || pageNum === activeTab.currentPage)
            .map((pageNum) => (
              <PageContainer
                key={pageNum}
                pageNum={pageNum}
                pdfDoc={pdfDoc}
                zoom={activeTab.zoom}
                activeMode={activeMode}
                activeTool={activeTool}
                setActiveTool={setActiveTool}
                commentColor={commentColor}
                strokeWidth={strokeWidth}
                savedSignatureDataUrl={savedSignatureDataUrl}
                onObjectSelected={setSelectedObject}
                onAddFormField={onAddFormField}
                formFields={formFields}
                onFormFieldClick={onFormFieldClick}
                onUpdateFormFieldValue={onUpdateFormFieldValue}
                registerFabricInstance={registerFabricInstance}
                unregisterFabricInstance={unregisterFabricInstance}
              />
            ))}
        </div>
      </div>
    </section>
  );
}

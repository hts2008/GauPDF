import React, { useRef, useEffect, useState } from 'react';

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

    // Listen to selections to display active object properties
    fCanvas.on('selection:created', (e) => {
      const obj = e.selected[0];
      let type = 'unknown';
      if (obj.type === 'i-text' || obj.type === 'text') type = 'text';
      else if (obj.type === 'path') type = 'drawing';
      onObjectSelected({
        type,
        ref: obj,
        text: obj.text,
        fill: obj.fill,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth,
        fontSize: obj.fontSize
      });
    });

    fCanvas.on('selection:updated', (e) => {
      const obj = e.selected[0];
      let type = 'unknown';
      if (obj.type === 'i-text' || obj.type === 'text') type = 'text';
      else if (obj.type === 'path') type = 'drawing';
      onObjectSelected({
        type,
        ref: obj,
        text: obj.text,
        fill: obj.fill,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth,
        fontSize: obj.fontSize
      });
    });

    fCanvas.on('selection:cleared', () => {
      onObjectSelected(null);
    });

    // Clicking on canvas to place stamps, text boxes, and signature images
    fCanvas.on('mouse:down', (options) => {
      const pointer = fCanvas.getPointer(options.e);

      if (activeTool === 'text') {
        const text = new window.fabric.IText('Enter text...', {
          left: pointer.x,
          top: pointer.y,
          fontFamily: 'Inter, sans-serif',
          fontSize: 14,
          fill: commentColor,
          editable: true
        });
        fCanvas.add(text);
        fCanvas.setActiveObject(text);
        text.enterEditing();
        fCanvas.renderAll();
        setActiveTool('select');
      } else if (activeTool === 'stamp') {
        const group = new window.fabric.Group([], {
          left: pointer.x,
          top: pointer.y,
          selectable: true,
          subTargetCheck: true
        });
        const border = new window.fabric.Rect({
          width: 120,
          height: 40,
          fill: 'rgba(16, 185, 129, 0.08)',
          stroke: '#10b981',
          strokeWidth: 2,
          rx: 4,
          ry: 4
        });
        const textObj = new window.fabric.Text('APPROVED', {
          fontFamily: 'Inter, sans-serif',
          fontSize: 13,
          fontWeight: 'bold',
          fill: '#10b981',
          left: 14,
          top: 12
        });
        group.addWithUpdate(border);
        group.addWithUpdate(textObj);
        fCanvas.add(group);
        fCanvas.setActiveObject(group);
        fCanvas.renderAll();
        setActiveTool('select');
      } else if (activeTool === 'note') {
        const circle = new window.fabric.Circle({
          radius: 12,
          fill: '#f59e0b',
          stroke: '#ffffff',
          strokeWidth: 2,
          left: pointer.x,
          top: pointer.y,
          hasControls: false
        });
        circle.noteText = 'Enter note here...';
        circle.isNote = true;
        fCanvas.add(circle);
        fCanvas.setActiveObject(circle);
        fCanvas.renderAll();
        setActiveTool('select');
        const txt = prompt('Enter note content:', circle.noteText);
        if (txt !== null) {
          circle.noteText = txt;
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
        onAddFormField(pageNum, 'text', pointer.x, pointer.y);
      } else if (activeTool === 'checkbox') {
        onAddFormField(pageNum, 'checkbox', pointer.x, pointer.y);
      }
    });

    return () => {
      fCanvas.dispose();
      unregisterFabricInstance(pageNum);
    };
  }, [pageNum, size, activeTool, commentColor, savedSignatureDataUrl]);

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

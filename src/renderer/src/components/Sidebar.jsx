import React, { useState, useEffect } from 'react';

// Left Sidebar Thumbnail Item Component
function Thumbnail({ pageNum, pdfDoc, isActive, onClick }) {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    let active = true;
    const renderThumbnail = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: 0.12 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };
        await page.render(renderContext).promise;
      } catch (err) {
        console.error('Error rendering thumbnail:', err);
      }
    };

    if (pdfDoc) {
      renderThumbnail();
    }
  }, [pdfDoc, pageNum]);

  return (
    <div className={`thumbnail-wrapper ${isActive ? 'active' : ''}`} onClick={onClick}>
      <div className="thumbnail-container">
        <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '80px' }} />
      </div>
      <span className="thumbnail-page-num">Page {pageNum}</span>
    </div>
  );
}

export default function Sidebar({
  side,
  isOpen,
  onClose,
  pdfDoc,
  currentPage,
  onGoToPage,
  onGoToDestination,
  selectedObject,
  setSelectedObject,
  onDeleteSelectedObject
}) {
  const [activeTab, setActiveTab] = useState('thumbnails'); // thumbnails | outline
  const [outline, setOutline] = useState([]);

  useEffect(() => {
    if (pdfDoc && pdfDoc.getOutline) {
      pdfDoc.getOutline().then(tree => {
        setOutline(tree || []);
      }).catch(err => {
        console.error('Error loading PDF outline:', err);
      });
    }
  }, [pdfDoc]);

  if (!isOpen) return null;

  // RENDER LEFT SIDEBAR
  if (side === 'left') {
    const renderOutlineItems = (items) => {
      return items.map((item, idx) => (
        <div key={idx} style={{ paddingLeft: '8px' }}>
          <div className="outline-item" onClick={() => onGoToDestination(item.dest)}>
            {item.title}
          </div>
          {item.items && item.items.length > 0 && renderOutlineItems(item.items)}
        </div>
      ));
    };

    const pagesArray = pdfDoc ? Array.from({ length: pdfDoc.numPages }, (_, i) => i + 1) : [];

    return (
      <aside id="left-sidebar" className="sidebar">
        <div className="sidebar-header">
          <h3>Navigation</h3>
          <button className="btn btn-icon" onClick={onClose} title="Close sidebar panel">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="sidebar-tabs">
          <button
            className={`sidebar-tab-btn ${activeTab === 'thumbnails' ? 'active' : ''}`}
            onClick={() => setActiveTab('thumbnails')}
          >
            Pages
          </button>
          <button
            className={`sidebar-tab-btn ${activeTab === 'outline' ? 'active' : ''}`}
            onClick={() => setActiveTab('outline')}
          >
            Outline
          </button>
        </div>
        <div className="sidebar-content">
          {activeTab === 'thumbnails' && (
            <div className="thumbnail-list">
              {pagesArray.map(pageNum => (
                <Thumbnail
                  key={pageNum}
                  pageNum={pageNum}
                  pdfDoc={pdfDoc}
                  isActive={currentPage === pageNum}
                  onClick={() => onGoToPage(pageNum)}
                />
              ))}
            </div>
          )}
          {activeTab === 'outline' && (
            <div className="outline-tree">
              {outline.length === 0 ? (
                <div style={{ padding: '20px 10px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  No bookmarks outline structure available.
                </div>
              ) : (
                renderOutlineItems(outline)
              )}
            </div>
          )}
        </div>
        <div className="sidebar-resizer"></div>
      </aside>
    );
  }

  // RENDER RIGHT SIDEBAR (PROPERTIES INSPECTOR)
  const handlePropertyChange = (newProps) => {
    if (selectedObject) {
      if (selectedObject.type === 'form') {
        // Update Form field details
        const { field, element } = selectedObject;
        if (newProps.id !== undefined) {
          field.id = newProps.id;
          if (element) element.id = newProps.id;
        }
        if (newProps.width !== undefined) {
          field.width = newProps.width;
          if (element) element.style.width = `${newProps.width}px`;
        }
        if (newProps.height !== undefined) {
          field.height = newProps.height;
          if (element) element.style.height = `${newProps.height}px`;
        }
        setSelectedObject({ ...selectedObject });
      } else if (selectedObject.ref) {
        // Update Fabric object properties
        selectedObject.ref.set(newProps);
        selectedObject.ref.canvas.renderAll();
        setSelectedObject(prev => ({ ...prev, ...newProps }));
      }
    }
  };

  return (
    <aside id="right-sidebar" className="sidebar">
      <div className="sidebar-header">
        <h3>Properties</h3>
        <button className="btn btn-icon" onClick={onClose} title="Close sidebar panel">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div className="sidebar-content">
        {!selectedObject ? (
          <div className="properties-empty">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <span>Select any annotation, form field or text object to inspect its properties.</span>
          </div>
        ) : (
          <div className="properties-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Text Properties */}
            {selectedObject.type === 'text' && (
              <div className="properties-group">
                <div className="properties-title">Text Box</div>
                <div className="form-group">
                  <label>Text Content:</label>
                  <input
                    type="text"
                    className="form-control"
                    value={selectedObject.text || ''}
                    onChange={(e) => handlePropertyChange({ text: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Font Size (px):</label>
                  <input
                    type="number"
                    className="form-control"
                    value={selectedObject.fontSize || 14}
                    onChange={(e) => handlePropertyChange({ fontSize: parseInt(e.target.value) || 12 })}
                  />
                </div>
                <div className="form-group">
                  <label>Text Color:</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="color"
                      value={selectedObject.fill || '#6366f1'}
                      onChange={(e) => handlePropertyChange({ fill: e.target.value })}
                      style={{ border: 'none', padding: 0, width: '32px', height: '32px', background: 'transparent', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '12px' }}>{selectedObject.fill}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Drawing/Path Properties */}
            {selectedObject.type === 'drawing' && (
              <div className="properties-group">
                <div className="properties-title">Freehand Stroke</div>
                <div className="form-group">
                  <label>Stroke Width (px):</label>
                  <input
                    type="number"
                    className="form-control"
                    value={selectedObject.strokeWidth || 3}
                    onChange={(e) => handlePropertyChange({ strokeWidth: parseInt(e.target.value) || 1 })}
                    min="1"
                    max="30"
                  />
                </div>
                <div className="form-group">
                  <label>Stroke Color:</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="color"
                      value={selectedObject.stroke || '#6366f1'}
                      onChange={(e) => handlePropertyChange({ stroke: e.target.value })}
                      style={{ border: 'none', padding: 0, width: '32px', height: '32px', background: 'transparent', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '12px' }}>{selectedObject.stroke}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Form Field Properties */}
            {selectedObject.type === 'form' && (
              <div className="properties-group">
                <div className="properties-title">Form Field</div>
                <div className="form-group">
                  <label>Field Identifier:</label>
                  <input
                    type="text"
                    className="form-control"
                    value={selectedObject.field.id || ''}
                    onChange={(e) => handlePropertyChange({ id: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Width (px):</label>
                  <input
                    type="number"
                    className="form-control"
                    value={selectedObject.field.width || 140}
                    onChange={(e) => handlePropertyChange({ width: parseInt(e.target.value) || 20 })}
                    min="10"
                  />
                </div>
                <div className="form-group">
                  <label>Height (px):</label>
                  <input
                    type="number"
                    className="form-control"
                    value={selectedObject.field.height || 24}
                    onChange={(e) => handlePropertyChange({ height: parseInt(e.target.value) || 10 })}
                    min="10"
                  />
                </div>
              </div>
            )}

            {/* Action Operations */}
            <div style={{ marginTop: '8px' }}>
              <button
                className="btn btn-secondary"
                onClick={onDeleteSelectedObject}
                style={{ width: '100%', borderColor: 'var(--danger)', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.05)' }}
              >
                Delete Object
              </button>
            </div>
            
          </div>
        )}
      </div>
      <div className="sidebar-resizer"></div>
    </aside>
  );
}

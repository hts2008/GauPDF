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

  const handleAddBookmark = () => {
    const title = prompt('Enter bookmark title:', `Page ${currentPage}`);
    if (title && title.trim()) {
      const trimmedTitle = title.trim();
      if (pdfDoc && pdfDoc.addBookmark) {
        pdfDoc.addBookmark(trimmedTitle, currentPage);
        pdfDoc.getOutline().then(tree => {
          setOutline([...tree]);
        });
      } else {
        const newBookmark = {
          id: 'bm_' + Math.random().toString(36).substring(2, 9),
          title: trimmedTitle,
          dest: currentPage,
          pageNumber: currentPage,
          items: []
        };
        setOutline(prev => [...prev, newBookmark]);
      }
    }
  };

  const handleEditBookmark = (item, e) => {
    e.stopPropagation();
    const newTitle = prompt('Edit bookmark title:', item.title);
    if (newTitle && newTitle.trim()) {
      const trimmedTitle = newTitle.trim();
      const pageStr = prompt('Enter page number:', item.pageNumber || item.dest || 1);
      const pageNum = parseInt(pageStr, 10) || 1;
      
      if (pdfDoc && pdfDoc.editBookmark) {
        pdfDoc.editBookmark(item.id, trimmedTitle, pageNum);
        pdfDoc.getOutline().then(tree => {
          setOutline([...tree]);
        });
      } else {
        const updateItems = (list) => {
          return list.map(x => {
            if (x === item || (x.id && x.id === item.id)) {
              return { ...x, title: trimmedTitle, dest: pageNum, pageNumber: pageNum };
            }
            if (x.items && x.items.length > 0) {
              return { ...x, items: updateItems(x.items) };
            }
            return x;
          });
        };
        setOutline(prev => updateItems(prev));
      }
    }
  };

  const handleDeleteBookmark = (item, e) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete bookmark "${item.title}"?`)) {
      if (pdfDoc && pdfDoc.removeBookmark) {
        pdfDoc.removeBookmark(item.id);
        pdfDoc.getOutline().then(tree => {
          setOutline([...tree]);
        });
      } else {
        const removeItems = (list) => {
          return list.filter(x => {
            if (x === item || (x.id && x.id === item.id)) return false;
            if (x.items && x.items.length > 0) {
              x.items = removeItems(x.items);
            }
            return true;
          });
        };
        setOutline(prev => removeItems(prev));
      }
    }
  };

  if (!isOpen) return null;

  // RENDER LEFT SIDEBAR
  if (side === 'left') {
    const renderOutlineItems = (items) => {
      return items.map((item, idx) => (
        <div key={idx} style={{ paddingLeft: '8px' }}>
          <div 
            className="outline-item" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '6px 8px', 
              borderRadius: '4px', 
              cursor: 'pointer', 
              gap: '8px',
              fontSize: '13px'
            }} 
            onClick={() => onGoToDestination(item.dest)}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {item.title}
            </span>
            <div className="bookmark-actions" style={{ display: 'flex', gap: '4px' }}>
              <button
                className="btn btn-icon"
                style={{ width: '22px', height: '22px', padding: 0, minWidth: 0, opacity: 0.6, border: 'none', background: 'transparent' }}
                onClick={(e) => handleEditBookmark(item, e)}
                title="Edit bookmark title"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </button>
              <button
                className="btn btn-icon"
                style={{ width: '22px', height: '22px', padding: 0, minWidth: 0, opacity: 0.6, border: 'none', background: 'transparent' }}
                onClick={(e) => handleDeleteBookmark(item, e)}
                title="Delete bookmark"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
              <button
                className="btn btn-primary"
                onClick={handleAddBookmark}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>Add Bookmark</span>
              </button>
              <div className="outline-tree" style={{ flex: 1, overflowY: 'auto' }}>
                {outline.length === 0 ? (
                  <div style={{ padding: '20px 10px', color: 'var(--text-muted)', textAlign: 'center', fontSize: '13px' }}>
                    No bookmarks outline structure available.
                  </div>
                ) : (
                  renderOutlineItems(outline)
                )}
              </div>
            </div>
          )}
        </div>
        <div className="sidebar-resizer"></div>
      </aside>
    );
  }

  // RENDER RIGHT SIDEBAR (PROPERTIES INSPECTOR)
  // RENDER RIGHT SIDEBAR (PROPERTIES INSPECTOR)
  const handlePropertyChange = (newProps) => {
    if (selectedObject) {
      if (selectedObject.ref) {
        const obj = selectedObject.ref;
        obj.set(newProps);

        // Sync custom properties
        if (newProps.fieldId !== undefined) obj.fieldId = newProps.fieldId;
        if (newProps.required !== undefined) obj.required = newProps.required;
        if (newProps.maxLength !== undefined) obj.maxLength = newProps.maxLength;
        if (newProps.noteText !== undefined) obj.noteText = newProps.noteText;
        if (newProps.stampText !== undefined) {
          obj.stampText = newProps.stampText;
          const textObj = obj.item(1);
          if (textObj) textObj.set('text', newProps.stampText.toUpperCase());
        }
        if (newProps.value !== undefined) {
          obj.value = newProps.value;
          if (obj.fieldType === 'checkbox') {
            const checkMark = obj.item(1);
            if (checkMark) checkMark.set('visible', !!newProps.value);
          } else if (obj.fieldType === 'text') {
            obj.set('text', newProps.value);
          }
        }

        obj.canvas.renderAll();
        setSelectedObject(prev => ({ ...prev, ...newProps }));
      } else if (selectedObject.type === 'form') {
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
        if (newProps.required !== undefined) {
          field.required = newProps.required;
        }
        if (newProps.maxLength !== undefined) {
          field.maxLength = newProps.maxLength;
        }
        setSelectedObject({ ...selectedObject });
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
            
            {/* Opacity Control (Shared for all Fabric objects) */}
            {selectedObject.ref && (
              <div className="properties-group">
                <div className="properties-title">General Properties</div>
                <div className="form-group">
                  <label>Opacity ({Math.round((selectedObject.opacity !== undefined ? selectedObject.opacity : 1.0) * 100)}%):</label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    className="form-control"
                    value={selectedObject.opacity !== undefined ? selectedObject.opacity : 1.0}
                    onChange={(e) => handlePropertyChange({ opacity: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
            )}

            {/* Text Properties */}
            {selectedObject.type === 'text' && (
              <div className="properties-group">
                <div className="properties-title">Text Box</div>
                <div className="form-group">
                  <label>Text Content:</label>
                  <textarea
                    className="form-control"
                    rows="3"
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
                      value={selectedObject.fill || '#000000'}
                      onChange={(e) => handlePropertyChange({ fill: e.target.value })}
                      style={{ border: 'none', padding: 0, width: '32px', height: '32px', background: 'transparent', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '12px' }}>{selectedObject.fill}</span>
                  </div>
                </div>
                <div className="form-group" style={{ display: 'flex', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedObject.fontWeight === 'bold'}
                      onChange={(e) => handlePropertyChange({ fontWeight: e.target.checked ? 'bold' : 'normal' })}
                    />
                    <span>Bold</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedObject.fontStyle === 'italic'}
                      onChange={(e) => handlePropertyChange({ fontStyle: e.target.checked ? 'italic' : 'normal' })}
                    />
                    <span>Italic</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!selectedObject.underline}
                      onChange={(e) => handlePropertyChange({ underline: e.target.checked })}
                    />
                    <span>Underline</span>
                  </label>
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

            {/* Note Circle Properties */}
            {selectedObject.type === 'note-circle' && (
              <div className="properties-group">
                <div className="properties-title">Note Circle</div>
                <div className="form-group">
                  <label>Note Content:</label>
                  <textarea
                    className="form-control"
                    rows="4"
                    value={selectedObject.noteText || ''}
                    onChange={(e) => handlePropertyChange({ noteText: e.target.value })}
                    placeholder="Type note details here..."
                  />
                </div>
              </div>
            )}

            {/* Text Callout Properties */}
            {selectedObject.type === 'text-callout' && (
              <div className="properties-group">
                <div className="properties-title">Text Callout</div>
                <div className="form-group">
                  <label>Text Content:</label>
                  <textarea
                    className="form-control"
                    rows="3"
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
                  <input
                    type="color"
                    value={selectedObject.fill || '#ff0000'}
                    onChange={(e) => handlePropertyChange({ fill: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Border Color:</label>
                  <input
                    type="color"
                    value={selectedObject.stroke || '#ff0000'}
                    onChange={(e) => handlePropertyChange({ stroke: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Background Color:</label>
                  <input
                    type="color"
                    value={selectedObject.backgroundColor || '#ffffff'}
                    onChange={(e) => handlePropertyChange({ backgroundColor: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* Stamp Properties */}
            {selectedObject.type === 'stamp' && (
              <div className="properties-group">
                <div className="properties-title">Stamp Details</div>
                <div className="form-group">
                  <label>Stamp Content:</label>
                  <select
                    className="form-control"
                    value={selectedObject.stampText || 'APPROVED'}
                    onChange={(e) => handlePropertyChange({ stampText: e.target.value })}
                  >
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                    <option value="VOID">VOID</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Angle (Rotation):</label>
                  <input
                    type="number"
                    className="form-control"
                    value={Math.round(selectedObject.angle || 0)}
                    onChange={(e) => handlePropertyChange({ angle: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            )}

            {/* Redaction Properties */}
            {selectedObject.type === 'redaction' && (
              <div className="properties-group">
                <div className="properties-title" style={{ color: '#ef4444' }}>Redaction Area</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: '1.4' }}>
                  <span>This area is marked for <strong>permanent redaction</strong>.</span>
                  <span>Click <strong>"Apply Redactions"</strong> in the toolbar to burn a solid black rectangle into the PDF and permanently hide the text and images underneath.</span>
                </div>
              </div>
            )}

            {/* Form Field Properties (both state-based and Fabric-based) */}
            {(selectedObject.type === 'form-field' || selectedObject.type === 'form') && (
              <div className="properties-group">
                <div className="properties-title">Form Field Inspector</div>
                <div className="form-group">
                  <label>Field Identifier:</label>
                  <input
                    type="text"
                    className="form-control"
                    value={selectedObject.fieldId || (selectedObject.field ? selectedObject.field.id : '')}
                    onChange={(e) => handlePropertyChange({ fieldId: e.target.value, id: e.target.value })}
                  />
                </div>
                
                {/* Max Length (Only show for Text fields) */}
                {(selectedObject.fieldType === 'text' || (selectedObject.field && selectedObject.field.type === 'text')) && (
                  <div className="form-group">
                    <label>Max Characters (0 for unlimited):</label>
                    <input
                      type="number"
                      className="form-control"
                      value={selectedObject.maxLength !== undefined ? selectedObject.maxLength : (selectedObject.field ? selectedObject.field.maxLength || 0 : 0)}
                      onChange={(e) => handlePropertyChange({ maxLength: parseInt(e.target.value) || 0 })}
                      min="0"
                    />
                  </div>
                )}

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!!selectedObject.required || (selectedObject.field && !!selectedObject.field.required)}
                      onChange={(e) => handlePropertyChange({ required: e.target.checked })}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span>Required Field</span>
                  </label>
                </div>

                <div className="form-group">
                  <label>Current Value:</label>
                  {selectedObject.fieldType === 'checkbox' || (selectedObject.field && selectedObject.field.type === 'checkbox') ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={!!selectedObject.value || (selectedObject.field && !!selectedObject.field.value)}
                        onChange={(e) => handlePropertyChange({ value: e.target.checked })}
                      />
                      <span>Checked State</span>
                    </label>
                  ) : (
                    <input
                      type="text"
                      className="form-control"
                      value={selectedObject.value || (selectedObject.field ? selectedObject.field.value || '' : '')}
                      onChange={(e) => handlePropertyChange({ value: e.target.value })}
                    />
                  )}
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

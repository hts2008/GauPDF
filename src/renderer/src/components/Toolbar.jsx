import React from 'react';
import { MODES } from '../../../shared/constants.js';

export default function Toolbar({
  activeMode,
  setActiveMode,
  activeTool,
  setActiveTool,
  commentColor,
  setCommentColor,
  strokeWidth,
  setStrokeWidth,
  zoom,
  setZoom,
  layout,
  setLayout,
  searchText,
  setSearchText,
  onOpenClick,
  onSaveClick,
  onSaveAsClick,
  onPrintClick,
  onSettingsClick,
  onOcrClick,
  onRotateLeft,
  onRotateRight,
  onDeletePage,
  onInsertBlankPage,
  onMergeClick,
  onSplitClick,
  onCompressClick,
  onSignatureClick,
  hasActiveDoc,
  onApplyRedactions,
  onSecurityClick
}) {
  return (
    <section id="toolbar-container">
      {/* Mode Selector and Main File Actions Row */}
      <div className="mode-selector-row">
        <nav className="mode-tabs">
          <div
            className={`mode-tab ${activeMode === MODES.VIEW ? 'active' : ''}`}
            onClick={() => setActiveMode(MODES.VIEW)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            <span>View PDF</span>
          </div>
          <div
            className={`mode-tab ${activeMode === MODES.EDIT ? 'active' : ''} ${!hasActiveDoc ? 'disabled' : ''}`}
            onClick={() => hasActiveDoc && setActiveMode(MODES.EDIT)}
            style={{ opacity: hasActiveDoc ? 1 : 0.5, cursor: hasActiveDoc ? 'pointer' : 'not-allowed' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            <span>Edit</span>
          </div>
          <div
            className={`mode-tab ${activeMode === MODES.COMMENT ? 'active' : ''} ${!hasActiveDoc ? 'disabled' : ''}`}
            onClick={() => hasActiveDoc && setActiveMode(MODES.COMMENT)}
            style={{ opacity: hasActiveDoc ? 1 : 0.5, cursor: hasActiveDoc ? 'pointer' : 'not-allowed' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>Annotate</span>
          </div>
          <div
            className={`mode-tab ${activeMode === MODES.ORGANIZE ? 'active' : ''} ${!hasActiveDoc ? 'disabled' : ''}`}
            onClick={() => hasActiveDoc && setActiveMode(MODES.ORGANIZE)}
            style={{ opacity: hasActiveDoc ? 1 : 0.5, cursor: hasActiveDoc ? 'pointer' : 'not-allowed' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
            <span>Organize</span>
          </div>
          <div
            className={`mode-tab ${activeMode === MODES.FORMS ? 'active' : ''} ${!hasActiveDoc ? 'disabled' : ''}`}
            onClick={() => hasActiveDoc && setActiveMode(MODES.FORMS)}
            style={{ opacity: hasActiveDoc ? 1 : 0.5, cursor: hasActiveDoc ? 'pointer' : 'not-allowed' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" ry="2"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="9" y1="12" x2="15" y2="12"/></svg>
            <span>Forms</span>
          </div>
        </nav>

        <div className="file-actions-row">
          <button onClick={onOpenClick} className="btn btn-secondary" title="Open PDF file">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            <span>Open</span>
          </button>
          <button onClick={onSaveClick} className="btn btn-primary" title="Save changes (Ctrl+S)" disabled={!hasActiveDoc}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            <span>Save</span>
          </button>
          <button onClick={onSaveAsClick} className="btn btn-secondary" title="Save as a new file" disabled={!hasActiveDoc}>
            <span>Save As...</span>
          </button>
          <button onClick={onPrintClick} className="btn btn-secondary" title="Print document (Ctrl+P)" disabled={!hasActiveDoc}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          </button>
          <button onClick={onSecurityClick} className="btn btn-icon" title="PDF security and passwords" disabled={!hasActiveDoc}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </button>
          <button onClick={onSettingsClick} className="btn btn-icon" title="System settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
        </div>
      </div>

      {/* Mode-based Sub-toolbars */}
      {hasActiveDoc && (
        <div className="dynamic-toolbars">
          {/* View Mode Toolbar */}
          {activeMode === MODES.VIEW && (
            <div id="toolbar-view" className="sub-toolbar active">
              <div className="tool-group">
                <button className="btn btn-icon" onClick={() => setZoom(Math.max(0.25, zoom - 0.15))} title="Zoom Out">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <input
                  type="text"
                  className="toolbar-number-input"
                  value={`${Math.round(zoom * 100)}%`}
                  readOnly
                />
                <button className="btn btn-icon" onClick={() => setZoom(Math.min(4.0, zoom + 0.15))} title="Zoom In">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
              </div>
              <select
                className="toolbar-select"
                value={zoom.toString()}
                onChange={(e) => setZoom(e.target.value)}
              >
                <option value="fit-width">Fit Width</option>
                <option value="fit-page">Fit Page</option>
                <option value="0.5">50%</option>
                <option value="0.75">75%</option>
                <option value="1.0">100%</option>
                <option value="1.25">125%</option>
                <option value="1.5">150%</option>
                <option value="2.0">200%</option>
              </select>
              <div className="toolbar-separator"></div>
              <div className="tool-group">
                <button
                  className={`btn btn-icon ${layout === 'single' ? 'active' : ''}`}
                  onClick={() => setLayout('single')}
                  title="Single Page"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                </button>
                <button
                  className={`btn btn-icon ${layout === 'continuous' ? 'active' : ''}`}
                  onClick={() => setLayout('continuous')}
                  title="Continuous Scroll"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="8" rx="1"/><rect x="3" y="13" width="18" height="8" rx="1"/></svg>
                </button>
              </div>
              <div className="toolbar-separator"></div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', maxWidth: '300px', marginLeft: 'auto' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search keywords..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          )}

          {/* Edit Mode Toolbar */}
          {activeMode === MODES.EDIT && (
            <div id="toolbar-edit" className="sub-toolbar active">
              <button
                className={`btn btn-icon ${activeTool === 'select' ? 'active' : ''}`}
                onClick={() => setActiveTool('select')}
                title="Select Object"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              </button>
              <button
                className={`btn btn-secondary ${activeTool === 'text' ? 'active' : ''}`}
                onClick={() => setActiveTool('text')}
                title="Add text annotation"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                <span>Add Text</span>
              </button>
              <button
                className={`btn btn-secondary ${activeTool === 'image' ? 'active' : ''}`}
                onClick={() => setActiveTool('image')}
                title="Add image overlay"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polygon points="21 15 16 10 5 21"/></svg>
                <span>Add Image</span>
              </button>
              
              <div className="toolbar-separator"></div>

              <button
                className={`btn btn-secondary ${activeTool === 'redact' ? 'active' : ''}`}
                onClick={() => setActiveTool('redact')}
                title="Draw redaction rectangles"
                style={{
                  background: activeTool === 'redact' ? 'rgba(239, 68, 68, 0.25)' : '',
                  color: activeTool === 'redact' ? '#ef4444' : '',
                  borderColor: activeTool === 'redact' ? '#ef4444' : ''
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="currentColor"/></svg>
                <span>Redact</span>
              </button>
              <button
                className="btn btn-secondary"
                onClick={onApplyRedactions}
                title="Permanently apply black redactions to document"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                  color: '#ef4444'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                <span>Apply Redactions</span>
              </button>

              <div className="toolbar-separator"></div>
              
              <button
                className="btn btn-secondary"
                onClick={onOcrClick}
                title="Extract text from pages (OCR)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h8l6 6v14c0 .5-.2 1-.6 1.4-.4.4-.9.6-1.4.6H6c-.5 0-1-.2-1.4-.6C4 23 4 22.5 4 22z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8"/><path d="M8 17h8"/></svg>
                <span>OCR Text Extract</span>
              </button>
            </div>
          )}

          {/* Comment Mode Toolbar */}
          {activeMode === MODES.COMMENT && (
            <div id="toolbar-comment" className="sub-toolbar active">
              <button
                className={`btn btn-icon ${activeTool === 'highlight' ? 'active' : ''}`}
                onClick={() => setActiveTool('highlight')}
                title="Highlight"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3-1.912 5.886a1 1 0 0 1-.95.691H2.946a1 1 0 0 0-.588 1.808l4.992 3.627a1 1 0 0 1 .363 1.118L5.8 22l4.992-3.627a1 1 0 0 1 1.176 0L17 22l-1.912-5.886a1 1 0 0 1 .363-1.118l4.992-3.627a1 1 0 0 0-.588-1.808h-6.192a1 1 0 0 1-.95-.691L12 3z"/></svg>
              </button>
              <button
                className={`btn btn-icon ${activeTool === 'underline' ? 'active' : ''}`}
                onClick={() => setActiveTool('underline')}
                title="Underline"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
              </button>
              <button
                className={`btn btn-icon ${activeTool === 'note' ? 'active' : ''}`}
                onClick={() => setActiveTool('note')}
                title="Add text note"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </button>
              <button
                className={`btn btn-icon ${activeTool === 'draw' ? 'active' : ''}`}
                onClick={() => setActiveTool('draw')}
                title="Freehand drawing brush"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </button>
              <button
                className={`btn btn-secondary ${activeTool === 'stamp' ? 'active' : ''}`}
                onClick={() => setActiveTool('stamp')}
                title="Stamp approval text"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m9.09 9 1-1a3 3 0 0 1 4.24 0 3 3 0 0 1 0 4.24l-3.33 3.33H15"/></svg>
                <span>Stamp</span>
              </button>
              <button
                className={`btn btn-icon ${activeTool === 'eraser' ? 'active' : ''}`}
                onClick={() => setActiveTool('eraser')}
                title="Erase annotations"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/></svg>
              </button>
              
              <div className="toolbar-separator"></div>
              
              <span className="property-label">Color:</span>
              <input
                type="color"
                value={commentColor}
                onChange={(e) => setCommentColor(e.target.value)}
                style={{ width: '28px', height: '28px', border: 'none', padding: 0, background: 'transparent', cursor: 'pointer' }}
              />
              
              <span className="property-label" style={{ marginLeft: '12px' }}>Line Width:</span>
              <input
                type="number"
                className="toolbar-number-input"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(parseInt(e.target.value) || 1)}
                min="1"
                max="20"
              />
            </div>
          )}

          {/* Organize Mode Toolbar */}
          {activeMode === MODES.ORGANIZE && (
            <div id="toolbar-organize" class="sub-toolbar active">
              <button className="btn btn-secondary" onClick={onRotateLeft} title="Rotate page left">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2.5 2v6h6"/><path d="M2.5 8a10 10 0 1 1 2.36 6.36"/></svg>
                <span>Rotate Left</span>
              </button>
              <button className="btn btn-secondary" onClick={onRotateRight} title="Rotate page right">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6"/><path d="M21.5 8a10 10 0 1 0-2.36 6.36"/></svg>
                <span>Rotate Right</span>
              </button>
              <button className="btn btn-secondary" onClick={onDeletePage} title="Delete selected page">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                <span>Delete Page</span>
              </button>
              <button className="btn btn-secondary" onClick={onInsertBlankPage} title="Insert blank page">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>Blank Page</span>
              </button>
              <div className="toolbar-separator"></div>
              <button className="btn btn-secondary" onClick={onMergeClick} title="Merge multiple PDF files">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                <span>Merge PDFs...</span>
              </button>
              <button className="btn btn-secondary" onClick={onSplitClick} title="Split PDF file">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
                <span>Split PDF...</span>
              </button>
              <button className="btn btn-secondary" onClick={onCompressClick} title="Compress PDF file size">
                <span>Compress PDF...</span>
              </button>
            </div>
          )}

          {/* Forms Mode Toolbar */}
          {activeMode === MODES.FORMS && (
            <div id="toolbar-forms" className="sub-toolbar active">
              <button
                className={`btn btn-icon ${activeTool === 'select' ? 'active' : ''}`}
                onClick={() => setActiveTool('select')}
                title="Select field"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
              </button>
              <button
                className={`btn btn-secondary ${activeTool === 'textfield' ? 'active' : ''}`}
                onClick={() => setActiveTool('textfield')}
                title="Add form text field"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="12" y1="9" x2="12" y2="15"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                <span>Text Field</span>
              </button>
              <button
                className={`btn btn-secondary ${activeTool === 'checkbox' ? 'active' : ''}`}
                onClick={() => setActiveTool('checkbox')}
                title="Add form checkbox"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><polyline points="9 11 12 14 22 4"/></svg>
                <span>Checkbox</span>
              </button>
              <div className="toolbar-separator"></div>
              <button
                className="btn btn-secondary"
                onClick={onSignatureClick}
                title="Draw and place signature"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>Signature...</span>
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

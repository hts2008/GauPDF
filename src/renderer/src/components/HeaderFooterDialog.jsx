import React, { useState } from 'react';
import { NotificationSystem } from '../utils/notifications.js';

export default function HeaderFooterDialog({ isOpen, onClose, onExecute }) {
  // Header text
  const [headerLeft, setHeaderLeft] = useState('');
  const [headerCenter, setHeaderCenter] = useState('');
  const [headerRight, setHeaderRight] = useState('');

  // Footer text
  const [footerLeft, setFooterLeft] = useState('');
  const [footerCenter, setFooterCenter] = useState('');
  const [footerRight, setFooterRight] = useState('');

  // Page numbers config
  const [addPageNumbers, setAddPageNumbers] = useState(true);
  const [pageNumberFormat, setPageNumberFormat] = useState('Page X of Y'); // 'X', 'Page X', 'Page X of Y'
  const [pageNumberPosition, setPageNumberPosition] = useState('bottom-right'); // 'top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'
  const [startPageNumber, setStartPageNumber] = useState(1);
  const [startApplyingFromPage, setStartApplyingFromPage] = useState(1);

  // Styling options
  const [fontSize, setFontSize] = useState(10);
  const [fontColor, setFontColor] = useState('#475569');
  const [pages, setPages] = useState('all'); // 'all', 'exclude-first', 'custom'
  const [customPages, setCustomPages] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (pages === 'custom' && !customPages.trim()) {
      NotificationSystem.warning('Validation Error', 'Please specify target page range.');
      return;
    }

    onExecute({
      header: {
        left: headerLeft,
        center: headerCenter,
        right: headerRight
      },
      footer: {
        left: footerLeft,
        center: footerCenter,
        right: footerRight
      },
      pageNumbers: {
        enabled: addPageNumbers,
        format: pageNumberFormat,
        position: pageNumberPosition,
        startNumber: parseInt(startPageNumber) || 1,
        startApplyingPage: parseInt(startApplyingFromPage) || 1
      },
      styling: {
        fontSize: parseInt(fontSize) || 10,
        color: fontColor
      },
      pages,
      customPages
    });
  };

  return (
    <div className="dialog-backdrop">
      <div className="dialog-window" style={{ width: '560px' }}>
        <div className="dialog-header">
          <h3>Add Headers & Footers</h3>
          <button className="dialog-close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
          
          {/* Header Sections */}
          <div className="form-group-section">
            <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block', color: 'var(--primary)' }}>Header Content</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label htmlFor="hf-header-left" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Left Section</label>
                <input
                  id="hf-header-left"
                  type="text"
                  className="form-control"
                  value={headerLeft}
                  onChange={(e) => setHeaderLeft(e.target.value)}
                  placeholder="Title / Text"
                />
              </div>
              <div>
                <label htmlFor="hf-header-center" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Center Section</label>
                <input
                  id="hf-header-center"
                  type="text"
                  className="form-control"
                  value={headerCenter}
                  onChange={(e) => setHeaderCenter(e.target.value)}
                  placeholder="Subject / Text"
                />
              </div>
              <div>
                <label htmlFor="hf-header-right" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Right Section</label>
                <input
                  id="hf-header-right"
                  type="text"
                  className="form-control"
                  value={headerRight}
                  onChange={(e) => setHeaderRight(e.target.value)}
                  placeholder="Date / Text"
                />
              </div>
            </div>
          </div>

          {/* Footer Sections */}
          <div className="form-group-section">
            <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block', color: 'var(--primary)' }}>Footer Content</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label htmlFor="hf-footer-left" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Left Section</label>
                <input
                  id="hf-footer-left"
                  type="text"
                  className="form-control"
                  value={footerLeft}
                  onChange={(e) => setFooterLeft(e.target.value)}
                  placeholder="Footer Text"
                />
              </div>
              <div>
                <label htmlFor="hf-footer-center" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Center Section</label>
                <input
                  id="hf-footer-center"
                  type="text"
                  className="form-control"
                  value={footerCenter}
                  onChange={(e) => setFooterCenter(e.target.value)}
                  placeholder="Footer Text"
                />
              </div>
              <div>
                <label htmlFor="hf-footer-right" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Right Section</label>
                <input
                  id="hf-footer-right"
                  type="text"
                  className="form-control"
                  value={footerRight}
                  onChange={(e) => setFooterRight(e.target.value)}
                  placeholder="Footer Text"
                />
              </div>
            </div>
          </div>

          {/* Page Numbering Options */}
          <div className="form-group-section" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', color: 'var(--primary)' }}>
              <input
                type="checkbox"
                checked={addPageNumbers}
                onChange={(e) => setAddPageNumbers(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
              />
              <span>Include Page Numbering</span>
            </label>
            
            {addPageNumbers && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '10px' }}>
                <div className="form-group">
                  <label htmlFor="hf-pn-format">Format</label>
                  <select
                    id="hf-pn-format"
                    className="form-control"
                    value={pageNumberFormat}
                    onChange={(e) => setPageNumberFormat(e.target.value)}
                  >
                    <option value="X">1, 2, 3...</option>
                    <option value="Page X">Page 1, Page 2...</option>
                    <option value="Page X of Y">Page 1 of 5, Page 2 of 5...</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="hf-pn-position">Placement</label>
                  <select
                    id="hf-pn-position"
                    className="form-control"
                    value={pageNumberPosition}
                    onChange={(e) => setPageNumberPosition(e.target.value)}
                  >
                    <option value="top-left">Header Left</option>
                    <option value="top-center">Header Center</option>
                    <option value="top-right">Header Right</option>
                    <option value="bottom-left">Footer Left</option>
                    <option value="bottom-center">Footer Center</option>
                    <option value="bottom-right">Footer Right</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="hf-start-number">Start Numbering at Page</label>
                  <input
                    id="hf-start-number"
                    type="number"
                    className="form-control"
                    value={startPageNumber}
                    onChange={(e) => setStartPageNumber(parseInt(e.target.value) || 1)}
                    min="1"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="hf-start-applying">Apply starting on Page</label>
                  <input
                    id="hf-start-applying"
                    type="number"
                    className="form-control"
                    value={startApplyingFromPage}
                    onChange={(e) => setStartApplyingFromPage(parseInt(e.target.value) || 1)}
                    min="1"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Typography & Targeting Options */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            <div className="form-group">
              <label htmlFor="hf-font-size">Font Size (pt)</label>
              <input
                id="hf-font-size"
                type="number"
                className="form-control"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value) || 8)}
                min="6"
                max="24"
              />
            </div>
            <div className="form-group">
              <label htmlFor="hf-font-color">Font Color</label>
              <input
                id="hf-font-color"
                type="color"
                className="form-control"
                style={{ padding: '0 4px', height: '36px', width: '100%', cursor: 'pointer' }}
                value={fontColor}
                onChange={(e) => setFontColor(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label htmlFor="hf-pages">Apply to Pages</label>
              <select
                id="hf-pages"
                className="form-control"
                value={pages}
                onChange={(e) => setPages(e.target.value)}
              >
                <option value="all">All Pages</option>
                <option value="exclude-first">All Pages Except First</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
            {pages === 'custom' && (
              <div className="form-group">
                <label htmlFor="hf-custom-pages">Page Range</label>
                <input
                  id="hf-custom-pages"
                  type="text"
                  className="form-control"
                  placeholder="e.g. 2-5, 8, 10"
                  value={customPages}
                  onChange={(e) => setCustomPages(e.target.value)}
                />
              </div>
            )}
          </div>

        </div>
        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit}>Apply Headers & Footers</button>
        </div>
      </div>
    </div>
  );
}

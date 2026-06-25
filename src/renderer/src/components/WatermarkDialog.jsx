import React, { useState } from 'react';
import { NotificationSystem } from '../utils/notifications.js';

export default function WatermarkDialog({ isOpen, onClose, onExecute }) {
  const [type, setType] = useState('text'); // 'text' | 'image'
  const [text, setText] = useState('CONFIDENTIAL');
  const [imageFile, setImageFile] = useState(null);
  const [imagePath, setImagePath] = useState('');
  const [opacity, setOpacity] = useState(0.3);
  const [angle, setAngle] = useState(45);
  const [fontSize, setFontSize] = useState(60);
  const [color, setColor] = useState('#ff0000');
  const [position, setPosition] = useState('center'); // 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  const [pages, setPages] = useState('all'); // 'all' | 'custom'
  const [customPages, setCustomPages] = useState('');

  if (!isOpen) return null;

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePath(file.path || file.name);
    }
  };

  const handleSelectElectronFile = async () => {
    if (window.api) {
      const files = await window.api.invoke('file:open', {
        title: 'Select Watermark Image',
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp'] }]
      });
      if (files && files.length > 0) {
        setImagePath(files[0]);
        // simulate standard file object name
        setImageFile({ name: files[0].split(/[/\\]/).pop(), path: files[0] });
      }
    }
  };

  const handleSubmit = () => {
    if (type === 'text' && !text.trim()) {
      NotificationSystem.warning('Validation Error', 'Please enter watermark text.');
      return;
    }
    if (type === 'image' && !imageFile && !imagePath) {
      NotificationSystem.warning('Validation Error', 'Please select a watermark image.');
      return;
    }
    if (pages === 'custom' && !customPages.trim()) {
      NotificationSystem.warning('Validation Error', 'Please specify target page range.');
      return;
    }

    onExecute({
      type,
      text,
      imagePath: imagePath || (imageFile ? imageFile.path || imageFile.name : ''),
      opacity: parseFloat(opacity),
      angle: parseInt(angle) || 0,
      fontSize: parseInt(fontSize) || 40,
      color,
      position,
      pages,
      customPages
    });
  };

  return (
    <div className="dialog-backdrop">
      <div className="dialog-window" style={{ width: '480px' }}>
        <div className="dialog-header">
          <h3>Apply Watermark</h3>
          <button className="dialog-close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Type Toggle */}
          <div className="form-group">
            <label>Watermark Type</label>
            <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="watermark-type"
                  checked={type === 'text'}
                  onChange={() => setType('text')}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span>Text Watermark</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="watermark-type"
                  checked={type === 'image'}
                  onChange={() => setType('image')}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span>Image Watermark</span>
              </label>
            </div>
          </div>

          {/* Conditional inputs */}
          {type === 'text' ? (
            <>
              <div className="form-group">
                <label htmlFor="wm-text">Watermark Text</label>
                <input
                  id="wm-text"
                  type="text"
                  className="form-control"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. DRAFT, CONFIDENTIAL"
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label htmlFor="wm-font-size">Font Size (pt)</label>
                  <input
                    id="wm-font-size"
                    type="number"
                    className="form-control"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value) || 12)}
                    min="10"
                    max="200"
                  />
                </div>
                <div className="form-group" style={{ width: '100px' }}>
                  <label htmlFor="wm-color">Text Color</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      id="wm-color"
                      type="color"
                      className="form-control"
                      style={{ padding: '0 4px', height: '36px', width: '100%', cursor: 'pointer' }}
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="form-group">
              <label>Select Watermark Image</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <input
                  type="text"
                  className="form-control"
                  value={imageFile ? imageFile.name : imagePath || ''}
                  placeholder="No file chosen"
                  readOnly
                />
                {window.api ? (
                  <button className="btn btn-secondary" onClick={handleSelectElectronFile}>Browse...</button>
                ) : (
                  <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Browse...
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            {/* Opacity Slider */}
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="wm-opacity">Opacity ({Math.round(opacity * 100)}%)</label>
              <input
                id="wm-opacity"
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                className="form-control-range"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--primary)', height: '24px', cursor: 'pointer' }}
              />
            </div>

            {/* Rotation Angle */}
            <div className="form-group" style={{ width: '120px' }}>
              <label htmlFor="wm-angle">Angle (deg)</label>
              <input
                id="wm-angle"
                type="number"
                className="form-control"
                value={angle}
                onChange={(e) => setAngle(parseInt(e.target.value) || 0)}
                min="-360"
                max="360"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            {/* Layout Position */}
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="wm-position">Position</label>
              <select
                id="wm-position"
                className="form-control"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              >
                <option value="center">Center Center</option>
                <option value="top-left">Top Left</option>
                <option value="top-right">Top Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="bottom-right">Bottom Right</option>
              </select>
            </div>

            {/* Page Range selector */}
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="wm-pages">Apply to Pages</label>
              <select
                id="wm-pages"
                className="form-control"
                value={pages}
                onChange={(e) => setPages(e.target.value)}
              >
                <option value="all">All Pages</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
          </div>

          {pages === 'custom' && (
            <div className="form-group">
              <label htmlFor="wm-custom-pages">Page Range (e.g. 1-5, 8, 11-15)</label>
              <input
                id="wm-custom-pages"
                type="text"
                className="form-control"
                placeholder="e.g. 1, 3, 5-10"
                value={customPages}
                onChange={(e) => setCustomPages(e.target.value)}
              />
            </div>
          )}

        </div>
        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit}>Apply Watermark</button>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { IPC_CHANNELS } from '../../../shared/constants.js';
import { NotificationSystem } from '../utils/notifications.js';

export default function Welcome({
  onOpenFile,
  onOpenMergeDialog,
  onOpenSplitDialog,
  onOpenCompressDialog,
  onOpenOcrDialog,
  onOpenSettingsDialog,
  onOpenConvertToPdfDialog,
  onOpenConvertFromPdfDialog,
  onOpenWatermarkDialog,
  onOpenHeaderFooterDialog
}) {
  const [recentFiles, setRecentFiles] = useState([]);

  const loadRecentFiles = async () => {
    let files = [];
    if (window.api && typeof window.api.invoke === 'function') {
      try {
        files = await window.api.invoke(IPC_CHANNELS.APP_RECENT_FILES, { action: 'get' });
      } catch (err) {
        console.error('Error fetching recent files via IPC, falling back', err);
      }
    } else {
      const stored = localStorage.getItem('gaupdf-recents');
      if (stored) {
        try {
          files = JSON.parse(stored);
        } catch (_) {}
      }
    }
    setRecentFiles(files);
  };

  useEffect(() => {
    loadRecentFiles();
  }, []);

  const handleOpenFileDialog = async () => {
    if (window.api && typeof window.api.invoke === 'function') {
      try {
        await window.api.invoke(IPC_CHANNELS.FILE_OPEN);
      } catch (err) {
        NotificationSystem.error('Open File', 'Error: ' + err.message);
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          onOpenFile(file.name, file);
        }
      };
      input.click();
    }
  };

  const handleClearHistory = async () => {
    if (window.api && typeof window.api.invoke === 'function') {
      try {
        await window.api.invoke(IPC_CHANNELS.APP_RECENT_FILES, { action: 'clear' });
      } catch (err) {
        console.error(err);
      }
    } else {
      localStorage.removeItem('gaupdf-recents');
    }
    NotificationSystem.success('History', 'Recent files history cleared successfully.');
    loadRecentFiles();
  };

  const handleRemoveRecent = async (e, filePath) => {
    e.stopPropagation();
    if (window.api && typeof window.api.invoke === 'function') {
      try {
        await window.api.invoke(IPC_CHANNELS.APP_RECENT_FILES, { action: 'remove', path: filePath });
      } catch (err) {
        console.error(err);
      }
    } else {
      let files = [];
      const stored = localStorage.getItem('gaupdf-recents');
      if (stored) {
        try { files = JSON.parse(stored); } catch (_) {}
      }
      files = files.filter(f => f.path !== filePath);
      localStorage.setItem('gaupdf-recents', JSON.stringify(files));
    }
    NotificationSystem.info('History', 'Removed file from history.');
    loadRecentFiles();
  };

  const handleRecentClick = (file) => {
    const pathStr = typeof file === 'string' ? file : file.path;
    const nameStr = typeof file === 'string' ? file.split(/[/\\]/).pop() : (file.name || file.path.split(/[/\\]/).pop());
    if (window.api) {
      window.api.openFileInNewWindow(pathStr);
    } else {
      onOpenFile(nameStr, null);
    }
  };

  return (
    <div id="welcome-dashboard">
      <div className="welcome-logo">
        <svg width="72" height="72" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="6" fill="url(#brand-grad-lg)"/>
          <path d="M7 17V7H11.5C13.5 7 15 8.2 15 10C15 11.8 13.5 13 11.5 13H9V17H7ZM9 11H11.5C12.5 11 13 10.6 13 10C13 9.4 12.5 9 11.5 9H9V11ZM15.5 13.2L17.5 17H15.2L13.4 13.5C14.2 13.5 15 13.4 15.5 13.2Z" fill="white"/>
          <defs>
            <linearGradient id="brand-grad-lg" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopColor="#818cf8"/>
              <stop offset="1" stopColor="#4f46e5"/>
            </linearGradient>
          </defs>
        </svg>
        <h1>GauPDF Editor</h1>
        <p>High-performance PDF editor, annotator, and processor designed for engineers, lawyers, and professional users.</p>
      </div>

      <div className="welcome-grid">
        <div className="quick-action-card" onClick={handleOpenFileDialog}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <span>Open PDF File</span>
          <p>Browse a PDF file from your computer</p>
        </div>
        <div className="quick-action-card" onClick={onOpenMergeDialog}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          <span>Merge PDFs</span>
          <p>Combine multiple documents into one</p>
        </div>
        <div className="quick-action-card" onClick={onOpenSplitDialog}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
          <span>Split PDF</span>
          <p>Extract separate page ranges</p>
        </div>
        <div className="quick-action-card" onClick={onOpenCompressDialog}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M4 12V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h8l6 6v4m-16 6v4c0 .5.2 1 .6 1.4C5 23.8 5.5 24 6 24h12c.5 0 1-.2 1.4-.6.4-.4.6-.9.6-1.4v-4"/></svg>
          <span>Compress PDF</span>
          <p>Reduce document file size</p>
        </div>

        {/* New Conversion Cards */}
        <div className="quick-action-card" onClick={onOpenConvertToPdfDialog}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span>Convert to PDF</span>
          <p>Convert Office files & images to PDF</p>
        </div>
        <div className="quick-action-card" onClick={onOpenConvertFromPdfDialog}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>Convert from PDF</span>
          <p>Convert PDF to Word, Excel, or Images</p>
        </div>

        {/* New Watermark & HeaderFooter Cards */}
        <div className="quick-action-card" onClick={onOpenWatermarkDialog}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span>Apply Watermark</span>
          <p>Add text or image watermarks to pages</p>
        </div>
        <div className="quick-action-card" onClick={onOpenHeaderFooterDialog}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
          <span>Header & Footer</span>
          <p>Add headers, footers, & page numbering</p>
        </div>

        <div className="quick-action-card" onClick={onOpenOcrDialog}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h8l6 6v14c0 .5-.2 1-.6 1.4-.4.4-.9.6-1.4.6H6c-.5 0-1-.2-1.4-.6C4 23 4 22.5 4 22z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8"/><path d="M8 17h8"/></svg>
          <span>OCR Extract</span>
          <p>Recognize text in scanned pages</p>
        </div>
        <div className="quick-action-card" onClick={onOpenSettingsDialog}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          <span>Settings</span>
          <p>System & display configuration</p>
        </div>
      </div>

      <div className="recents-container">
        <div className="recents-header">
          <h3>Recent Files</h3>
          {recentFiles.length > 0 && (
            <button className="clear-recents-btn" onClick={handleClearHistory}>Clear History</button>
          )}
        </div>
        <div className="recents-list">
          {recentFiles.length === 0 ? (
            <div className="recents-empty">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <span>No PDF files opened recently.</span>
            </div>
          ) : (
            recentFiles.map((file, idx) => {
              const pathStr = typeof file === 'string' ? file : file.path;
              const nameStr = typeof file === 'string' ? file.split(/[/\\]/).pop() : (file.name || file.path.split(/[/\\]/).pop());
              return (
                <div key={idx} className="recent-item" onClick={() => handleRecentClick(file)}>
                  <div className="recent-info">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <div className="recent-details">
                      <span className="recent-name" title={nameStr}>{nameStr}</span>
                      <span className="recent-path" title={pathStr}>{pathStr}</span>
                    </div>
                  </div>
                  <div className="recent-actions">
                    <button className="recent-action-btn remove" onClick={(e) => handleRemoveRecent(e, pathStr)} title="Remove from list">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

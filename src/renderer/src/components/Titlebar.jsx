import React, { useState, useEffect, useRef } from 'react';
import { IPC_CHANNELS } from '../../../shared/constants.js';

export default function Titlebar({
  onOpenClick,
  onSaveClick,
  onSaveAsClick,
  onPrintClick,
  onSettingsClick,
  onMergeClick,
  onSplitClick,
  onCompressClick,
  onOcrClick,
  onSignatureClick,
  onWatermarkClick,
  onHeaderFooterClick,
  onConvertToPdfClick,
  onConvertFromPdfClick,
  hasActiveDoc,
  recentFiles = [],
  onRecentClick,
  onNewClick
}) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null); // null | 'file' | 'convert' | 'tools'
  const menuRef = useRef(null);

  useEffect(() => {
    if (window.api && typeof window.api.on === 'function') {
      const cleanup = window.api.on('window:maximized', (event, state) => {
        setIsMaximized(state);
      });
      return cleanup;
    }
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenu(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleMinimize = () => {
    if (window.api) window.api.send(IPC_CHANNELS.APP_MINIMIZE);
  };

  const handleMaximize = () => {
    if (window.api) window.api.send(IPC_CHANNELS.APP_MAXIMIZE);
  };

  const handleClose = () => {
    if (window.api) window.api.send(IPC_CHANNELS.APP_CLOSE);
  };

  const toggleMenu = (menuName, e) => {
    e.stopPropagation();
    setActiveMenu(prev => prev === menuName ? null : menuName);
  };

  const handleMenuHover = (menuName) => {
    if (activeMenu !== null) {
      setActiveMenu(menuName);
    }
  };

  const handleAction = (callback) => {
    setActiveMenu(null);
    if (callback) callback();
  };

  return (
    <header id="titlebar">
      <div className="window-title-section">
        <div className="window-logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="6" fill="url(#brand-grad-title)"/>
            <path d="M7 17V7H11.5C13.5 7 15 8.2 15 10C15 11.8 13.5 13 11.5 13H9V17H7ZM9 11H11.5C12.5 11 13 10.6 13 10C13 9.4 12.5 9 11.5 9H9V11ZM15.5 13.2L17.5 17H15.2L13.4 13.5C14.2 13.5 15 13.4 15.5 13.2Z" fill="white"/>
            <defs>
              <linearGradient id="brand-grad-title" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                <stop stopColor="#818cf8"/>
                <stop offset="1" stopColor="#4f46e5"/>
              </linearGradient>
            </defs>
          </svg>
          <span>GauPDF</span>
        </div>

        {/* Menu Bar */}
        <nav className="title-menu-bar" ref={menuRef}>
          {/* File Menu */}
          <div className={`title-menu-item-container ${activeMenu === 'file' ? 'active' : ''}`}>
            <button
              className="title-menu-btn"
              onClick={(e) => toggleMenu('file', e)}
              onMouseEnter={() => handleMenuHover('file')}
            >
              File
            </button>
            {activeMenu === 'file' && (
              <div className="title-dropdown-menu">
                <button className="dropdown-item" onClick={() => handleAction(onNewClick)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                  <span>New PDF Document</span>
                  <kbd>Ctrl+N</kbd>
                </button>
                <button className="dropdown-item" onClick={() => handleAction(onOpenClick)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                  <span>Open File...</span>
                  <kbd>Ctrl+O</kbd>
                </button>
                
                {/* Open Recent Submenu */}
                <div className="dropdown-submenu-container">
                  <div className="dropdown-item submenu-trigger">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
                    <span>Open Recent</span>
                    <span className="submenu-arrow">▶</span>
                  </div>
                  <div className="dropdown-submenu">
                    {recentFiles && recentFiles.length > 0 ? (
                      recentFiles.map((file, idx) => {
                        const pathStr = typeof file === 'string' ? file : file.path;
                        const nameStr = typeof file === 'string' ? file.split(/[/\\]/).pop() : (file.name || file.path.split(/[/\\]/).pop());
                        return (
                          <button key={idx} className="dropdown-item" onClick={() => handleAction(() => onRecentClick(file))} title={pathStr}>
                            <span className="recent-submenu-name">{nameStr}</span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="dropdown-item disabled">No recent files</div>
                    )}
                  </div>
                </div>

                <div className="dropdown-divider"></div>
                <button className="dropdown-item" onClick={() => handleAction(onSaveClick)} disabled={!hasActiveDoc}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  <span>Save</span>
                  <kbd>Ctrl+S</kbd>
                </button>
                <button className="dropdown-item" onClick={() => handleAction(onSaveAsClick)} disabled={!hasActiveDoc}>
                  <span>Save As...</span>
                  <kbd>Ctrl+Shift+S</kbd>
                </button>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item" onClick={() => handleAction(onPrintClick)} disabled={!hasActiveDoc}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  <span>Print...</span>
                  <kbd>Ctrl+P</kbd>
                </button>
                <button className="dropdown-item" onClick={() => handleAction(onSettingsClick)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  <span>Settings</span>
                </button>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item" onClick={() => handleAction(handleClose)}>
                  <span>Exit</span>
                </button>
              </div>
            )}
          </div>

          {/* Convert Menu */}
          <div className={`title-menu-item-container ${activeMenu === 'convert' ? 'active' : ''}`}>
            <button
              className="title-menu-btn"
              onClick={(e) => toggleMenu('convert', e)}
              onMouseEnter={() => handleMenuHover('convert')}
            >
              Convert
            </button>
            {activeMenu === 'convert' && (
              <div className="title-dropdown-menu">
                <button className="dropdown-item" onClick={() => handleAction(onConvertToPdfClick)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span>Convert to PDF...</span>
                </button>
                <button className="dropdown-item" onClick={() => handleAction(onConvertFromPdfClick)} disabled={!hasActiveDoc}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <span>Convert from PDF...</span>
                </button>
              </div>
            )}
          </div>

          {/* Tools Menu */}
          <div className={`title-menu-item-container ${activeMenu === 'tools' ? 'active' : ''}`}>
            <button
              className="title-menu-btn"
              onClick={(e) => toggleMenu('tools', e)}
              onMouseEnter={() => handleMenuHover('tools')}
            >
              Tools
            </button>
            {activeMenu === 'tools' && (
              <div className="title-dropdown-menu">
                <button className="dropdown-item" onClick={() => handleAction(onMergeClick)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                  <span>Merge PDFs...</span>
                </button>
                <button className="dropdown-item" onClick={() => handleAction(onSplitClick)} disabled={!hasActiveDoc}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
                  <span>Split PDF...</span>
                </button>
                <button className="dropdown-item" onClick={() => handleAction(onCompressClick)} disabled={!hasActiveDoc}>
                  <span>Compress PDF...</span>
                </button>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item" onClick={() => handleAction(onOcrClick)} disabled={!hasActiveDoc}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h8l6 6v14c0 .5-.2 1-.6 1.4-.4.4-.9.6-1.4.6H6c-.5 0-1-.2-1.4-.6C4 23 4 22.5 4 22z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8"/><path d="M8 17h8"/></svg>
                  <span>OCR Text Extract...</span>
                </button>
                <button className="dropdown-item" onClick={() => handleAction(onSignatureClick)} disabled={!hasActiveDoc}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <span>Place Signature...</span>
                </button>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item" onClick={() => handleAction(onWatermarkClick)} disabled={!hasActiveDoc}>
                  <span>Apply Watermark...</span>
                </button>
                <button className="dropdown-item" onClick={() => handleAction(onHeaderFooterClick)} disabled={!hasActiveDoc}>
                  <span>Headers & Footers...</span>
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>

      <div className="window-controls">
        <button id="btn-minimize" className="win-btn" onClick={handleMinimize} title="Minimize">
          <svg width="10" height="1" viewBox="0 0 10 1" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line y1="0.5" x2="10" y2="0.5" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </button>
        <button id="btn-maximize" className="win-btn" onClick={handleMaximize} title={isMaximized ? "Restore" : "Maximize"}>
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 1h6v6H3V1z" stroke="currentColor" strokeWidth="1.5" fill="none" />
              <path d="M1 3h6v6H1V3z" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="8" height="8" stroke="currentColor" strokeWidth="1.5" fill="none"/>
            </svg>
          )}
        </button>
        <button id="btn-close" className="win-btn close-btn" onClick={handleClose} title="Close">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        </button>
      </div>
    </header>
  );
}

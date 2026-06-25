import React, { useState, useEffect } from 'react';
import { IPC_CHANNELS } from '../../../shared/constants.js';

export default function Titlebar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (window.api && typeof window.api.on === 'function') {
      const cleanup = window.api.on('window:maximized', (event, state) => {
        setIsMaximized(state);
      });
      return cleanup;
    }
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

  return (
    <header id="titlebar">
      <div className="window-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="6" fill="url(#brand-grad)"/>
          <path d="M7 17V7H11.5C13.5 7 15 8.2 15 10C15 11.8 13.5 13 11.5 13H9V17H7ZM9 11H11.5C12.5 11 13 10.6 13 10C13 9.4 12.5 9 11.5 9H9V11ZM15.5 13.2L17.5 17H15.2L13.4 13.5C14.2 13.5 15 13.4 15.5 13.2Z" fill="white"/>
          <defs>
            <linearGradient id="brand-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop stopColor="#818cf8"/>
              <stop offset="1" stopColor="#4f46e5"/>
            </linearGradient>
          </defs>
        </svg>
        <span>GauPDF Editor</span>
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

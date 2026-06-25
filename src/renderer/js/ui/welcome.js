/* src/renderer/js/ui/welcome.js */

import { IPC_CHANNELS } from '../../../shared/constants.js';
import { NotificationSystem } from './notifications.js';

export class WelcomeController {
  static appInstance = null; // Reference to main app instance

  static init(appInstance) {
    this.appInstance = appInstance;

    // Quick Actions
    const cardOpen = document.getElementById('card-open-pdf');
    const cardMerge = document.getElementById('card-merge-pdfs');
    const cardSplit = document.getElementById('card-split-pdf');
    const cardCompress = document.getElementById('card-compress-pdf');
    const cardOcr = document.getElementById('card-ocr');
    const cardSettings = document.getElementById('card-settings');
    const btnClearRecents = document.getElementById('btn-clear-recents');

    if (cardOpen) cardOpen.addEventListener('click', () => this.appInstance.openFileDialog());
    if (cardMerge) cardMerge.addEventListener('click', () => this.appInstance.dialogs.show('merge'));
    if (cardSplit) cardSplit.addEventListener('click', () => this.appInstance.dialogs.show('split'));
    if (cardCompress) cardCompress.addEventListener('click', () => this.appInstance.dialogs.show('compress'));
    if (cardOcr) cardOcr.addEventListener('click', () => this.appInstance.dialogs.show('ocr'));
    if (cardSettings) cardSettings.addEventListener('click', () => this.appInstance.dialogs.show('settings'));

    if (btnClearRecents) {
      btnClearRecents.addEventListener('click', () => this.clearRecents());
    }

    this.loadRecentFiles();
  }

  static async loadRecentFiles() {
    let recentFiles = [];

    // Attempt IPC load
    if (window.api && typeof window.api.invoke === 'function') {
      try {
        recentFiles = await window.api.invoke(IPC_CHANNELS.APP_RECENT_FILES, { action: 'get' });
      } catch (err) {
        console.error('Error fetching recent files via IPC, falling back', err);
      }
    } else {
      // LocalStorage fallback
      const stored = localStorage.getItem('gaupdf-recents');
      if (stored) {
        try {
          recentFiles = JSON.parse(stored);
        } catch (_) {}
      }
    }

    this.renderRecentFiles(recentFiles);
  }

  static renderRecentFiles(files) {
    const listEl = document.getElementById('recent-documents-list');
    if (!listEl) return;

    if (!files || files.length === 0) {
      listEl.innerHTML = `
        <div class="recents-empty">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          <span>Chưa có tệp PDF nào mở gần đây.</span>
        </div>
      `;
      return;
    }

    listEl.innerHTML = '';
    files.forEach(file => {
      const item = document.createElement('div');
      item.className = 'recent-item';
      
      const fileName = file.name || file.path.split(/[/\\]/).pop();

      item.innerHTML = `
        <div class="recent-info">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <div class="recent-details">
            <span class="recent-name" title="${fileName}">${fileName}</span>
            <span class="recent-path" title="${file.path}">${file.path}</span>
          </div>
        </div>
        <div class="recent-actions">
          <button class="recent-action-btn remove" title="Xóa khỏi danh sách">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      `;

      // Click to open recent
      item.addEventListener('click', (e) => {
        // If clicking remove button, ignore opening
        if (e.target.closest('.remove')) return;
        this.appInstance.openFilePath(file.path);
      });

      // Remove from list click listener
      const removeBtn = item.querySelector('.remove');
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeRecentFile(file.path);
      });

      listEl.appendChild(item);
    });
  }

  static async addRecentFile(filePath) {
    const fileName = filePath.split(/[/\\]/).pop();
    const newFile = { name: fileName, path: filePath, date: new Date().toISOString() };

    if (window.api && typeof window.api.invoke === 'function') {
      try {
        await window.api.invoke(IPC_CHANNELS.APP_RECENT_FILES, { action: 'add', file: newFile });
      } catch (err) {
        console.error('Error adding recent file via IPC', err);
      }
    } else {
      let recentFiles = [];
      const stored = localStorage.getItem('gaupdf-recents');
      if (stored) {
        try { recentFiles = JSON.parse(stored); } catch (_) {}
      }
      // Remove duplicate
      recentFiles = recentFiles.filter(f => f.path !== filePath);
      recentFiles.unshift(newFile);
      // Cap at 10
      if (recentFiles.length > 10) recentFiles.pop();
      localStorage.setItem('gaupdf-recents', JSON.stringify(recentFiles));
    }

    this.loadRecentFiles();
  }

  static async removeRecentFile(filePath) {
    if (window.api && typeof window.api.invoke === 'function') {
      try {
        await window.api.invoke(IPC_CHANNELS.APP_RECENT_FILES, { action: 'remove', path: filePath });
      } catch (err) {
        console.error('Error removing recent file via IPC', err);
      }
    } else {
      let recentFiles = [];
      const stored = localStorage.getItem('gaupdf-recents');
      if (stored) {
        try { recentFiles = JSON.parse(stored); } catch (_) {}
      }
      recentFiles = recentFiles.filter(f => f.path !== filePath);
      localStorage.setItem('gaupdf-recents', JSON.stringify(recentFiles));
    }

    NotificationSystem.info('Lịch sử', 'Đã xóa tệp khỏi lịch sử gần đây.');
    this.loadRecentFiles();
  }

  static async clearRecents() {
    if (window.api && typeof window.api.invoke === 'function') {
      try {
        await window.api.invoke(IPC_CHANNELS.APP_RECENT_FILES, { action: 'clear' });
      } catch (err) {
        console.error('Error clearing recent files via IPC', err);
      }
    } else {
      localStorage.removeItem('gaupdf-recents');
    }

    NotificationSystem.success('Lịch sử', 'Đã xóa toàn bộ lịch sử tệp mở gần đây.');
    this.loadRecentFiles();
  }
}

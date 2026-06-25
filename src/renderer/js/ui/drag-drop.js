/* src/renderer/js/ui/drag-drop.js */

import { NotificationSystem } from './notifications.js';

export class DragDropHandler {
  static init(appInstance) {
    const dropTargets = [document.getElementById('document-viewport'), document.getElementById('welcome-dashboard')];

    dropTargets.forEach(target => {
      if (!target) return;

      target.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        target.classList.add('dragover');
      });

      target.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        target.classList.remove('dragover');
      });

      target.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        target.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
          const file = files[0];
          if (file.name.toLowerCase().endsWith('.pdf')) {
            // Check if file.path exists (electron context), fallback to mock in browser
            const path = file.path || file.name;
            console.log(`PDF file dropped: ${path}`);
            appInstance.openFilePath(path, file); // Send both path and native File object for web fallback
          } else {
            NotificationSystem.warning('Kéo thả tệp', 'Chỉ hỗ trợ nhập các tệp tin dạng PDF.');
          }
        }
      });
    });
  }
}

/* src/renderer/js/ui/keyboard.js */

export class KeyboardShortcuts {
  static init(appInstance) {
    window.addEventListener('keydown', (e) => {
      // Check if user is typing in text inputs
      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
      
      const isCmd = e.ctrlKey || e.metaKey;

      if (isCmd) {
        switch (e.key.toLowerCase()) {
          case 'o':
            e.preventDefault();
            appInstance.openFileDialog();
            break;
          case 's':
            e.preventDefault();
            appInstance.saveActiveDocument();
            break;
          case 'p':
            e.preventDefault();
            appInstance.printActiveDocument();
            break;
          case '=': // Ctrl + +
          case '+':
            e.preventDefault();
            appInstance.zoomIn();
            break;
          case '-':
            e.preventDefault();
            appInstance.zoomOut();
            break;
          case '0':
            e.preventDefault();
            appInstance.setZoom(1.0);
            break;
          case 'z':
            // Ctrl+Z (Undo annotation)
            if (!isInput) {
              e.preventDefault();
              appInstance.annotations.undo();
            }
            break;
          case 'y':
            // Ctrl+Y (Redo annotation)
            if (!isInput) {
              e.preventDefault();
              appInstance.annotations.redo();
            }
            break;
        }
      } else {
        // Individual keys (like Delete)
        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (!isInput) {
            // Delete active drawing/annotation object
            appInstance.annotations.deleteSelected();
          }
        }
      }
    });
  }
}

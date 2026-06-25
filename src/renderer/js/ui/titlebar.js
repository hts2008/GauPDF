/* src/renderer/js/ui/titlebar.js */

import { IPC_CHANNELS } from '../../../shared/constants.js';

export class TitlebarController {
  static init() {
    const btnMin = document.getElementById('btn-minimize');
    const btnMax = document.getElementById('btn-maximize');
    const btnClose = document.getElementById('btn-close');

    if (btnMin) {
      btnMin.addEventListener('click', () => {
        if (window.api && typeof window.api.send === 'function') {
          window.api.send(IPC_CHANNELS.APP_MINIMIZE);
        } else {
          console.log('Titlebar minimize requested (no window.api)');
        }
      });
    }

    if (btnMax) {
      btnMax.addEventListener('click', () => {
        if (window.api && typeof window.api.send === 'function') {
          window.api.send(IPC_CHANNELS.APP_MAXIMIZE);
        } else {
          console.log('Titlebar maximize requested (no window.api)');
        }
      });
    }

    if (btnClose) {
      btnClose.addEventListener('click', () => {
        if (window.api && typeof window.api.send === 'function') {
          window.api.send(IPC_CHANNELS.APP_CLOSE);
        } else {
          console.log('Titlebar close requested (no window.api)');
        }
      });
    }
  }
}

// src/renderer/js/utils/dom-utils.js

/**
 * Quick query selector helper
 * @param {string} selector 
 * @param {Document|HTMLElement} parent 
 * @returns {HTMLElement|null}
 */
export function qs(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * Quick query selector all helper
 * @param {string} selector 
 * @param {Document|HTMLElement} parent 
 * @returns {NodeList}
 */
export function qsa(selector, parent = document) {
  return parent.querySelectorAll(selector);
}

/**
 * Create a DOM element with attributes and children
 * @param {string} tag 
 * @param {Object} attrs 
 * @param {Array<HTMLElement|string>} children 
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'className') {
      el.className = val;
    } else if (key === 'style' && typeof val === 'object') {
      Object.assign(el.style, val);
    } else if (key === 'dataset' && typeof val === 'object') {
      Object.assign(el.dataset, val);
    } else if (typeof val === 'function' && key.startsWith('on')) {
      el.addEventListener(key.slice(2).toLowerCase(), val);
    } else {
      el.setAttribute(key, val);
    }
  }

  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else if (child instanceof HTMLElement) {
      el.appendChild(child);
    }
  }

  return el;
}

/**
 * Show a DOM element
 * @param {HTMLElement} el 
 */
export function show(el) {
  if (el) el.style.display = '';
}

/**
 * Hide a DOM element
 * @param {HTMLElement} el 
 */
export function hide(el) {
  if (el) el.style.display = 'none';
}

/**
 * Toggle custom class
 * @param {HTMLElement} el 
 * @param {string} className 
 * @param {boolean} [force] 
 */
export function toggleClass(el, className, force) {
  if (el) el.classList.toggle(className, force);
}

/**
 * Event listener wrapper that returns a cleanup function
 * @param {HTMLElement|Window|Document} el 
 * @param {string} event 
 * @param {Function} handler 
 * @param {Object} [options] 
 * @returns {Function} Clean up function
 */
export function on(el, event, handler, options) {
  if (!el) return () => {};
  el.addEventListener(event, handler, options);
  return () => el.removeEventListener(event, handler, options);
}

/**
 * Toast Notification system
 */
export const toast = {
  container: null,

  _init() {
    if (this.container) return;
    this.container = createElement('div', {
      className: 'toast-container',
      style: {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: '9999',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none'
      }
    });
    document.body.appendChild(this.container);
  },

  show(message, type = 'info', duration = 3000) {
    this._init();
    
    // Background and text color based on toast type
    const styles = {
      padding: '12px 20px',
      borderRadius: '6px',
      color: '#fff',
      fontSize: '14px',
      fontFamily: 'sans-serif',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      opacity: '0',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      transform: 'translateY(20px)',
      pointerEvents: 'auto',
      maxWidth: '350px',
      wordBreak: 'break-word'
    };

    switch (type) {
      case 'success':
        styles.backgroundColor = '#4caf50';
        break;
      case 'error':
        styles.backgroundColor = '#f44336';
        break;
      case 'warning':
        styles.backgroundColor = '#ff9800';
        break;
      default: // info
        styles.backgroundColor = '#2196f3';
    }

    const toastEl = createElement('div', { style: styles }, [message]);
    this.container.appendChild(toastEl);

    // Trigger reflow & animate in
    requestAnimationFrame(() => {
      toastEl.style.opacity = '1';
      toastEl.style.transform = 'translateY(0)';
    });

    // Remove toast after duration
    setTimeout(() => {
      toastEl.style.opacity = '0';
      toastEl.style.transform = 'translateY(-20px)';
      toastEl.addEventListener('transitionend', () => {
        toastEl.remove();
      });
    }, duration);
  }
};

/**
 * Global application loader manager
 */
export const loader = {
  el: null,

  show(message = 'Processing...') {
    if (!this.el) {
      this.el = createElement('div', {
        className: 'app-loader',
        style: {
          position: 'fixed',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          zIndex: '10000',
          fontFamily: 'sans-serif'
        }
      }, [
        createElement('div', {
          className: 'spinner',
          style: {
            width: '40px',
            height: '40px',
            border: '4px solid rgba(255,255,255,0.3)',
            borderTop: '4px solid #fff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '15px'
          }
        }),
        createElement('div', { className: 'loader-text' }, [message])
      ]);

      // Add spin keyframe to document styles if not present
      if (!qs('#loader-style')) {
        const styleSheet = createElement('style', { id: 'loader-style' }, [
          `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`
        ]);
        document.head.appendChild(styleSheet);
      }

      document.body.appendChild(this.el);
    } else {
      const textEl = qs('.loader-text', this.el);
      if (textEl) textEl.textContent = message;
      show(this.el);
    }
  },

  hide() {
    if (this.el) {
      hide(this.el);
    }
  }
};

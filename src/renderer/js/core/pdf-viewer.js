// src/renderer/js/core/pdf-viewer.js
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export class PDFViewer {
  /**
   * @param {HTMLElement} containerEl The DOM container where pages will render
   * @param {Object} options Configuration options
   */
  constructor(containerEl, options = {}) {
    if (!containerEl) {
      throw new Error('PDFViewer: Container element is required');
    }
    this.containerEl = containerEl;
    this.options = Object.assign({
      defaultScale: 1.0,
      minScale: 0.25,
      maxScale: 5.0,
      scaleStep: 0.15,
      renderInteractiveForms: true
    }, options);

    this.pdfDoc = null;
    this.scale = this.options.defaultScale;
    this.rotation = 0; // 0, 90, 180, 270
    this.pages = []; // Holds metadata, canvases, and render tasks for each page
    this.pdfBytes = null; // Stored ArrayBuffer
    
    // Event listeners
    this.listeners = {
      documentLoaded: [],
      pageRendered: [],
      zoomChanged: [],
      rotationChanged: [],
      error: []
    };

    this._initContainer();
  }

  _initContainer() {
    this.containerEl.style.position = 'relative';
    this.containerEl.style.overflow = 'auto';
    this.containerEl.style.display = 'flex';
    this.containerEl.style.flexDirection = 'column';
    this.containerEl.style.alignItems = 'center';
    this.containerEl.style.gap = '20px';
    this.containerEl.style.padding = '20px';
    this.containerEl.style.boxSizing = 'border-box';
    this.containerEl.style.backgroundColor = '#525659'; // Classic PDF viewer grey
  }

  // Event dispatching
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  _trigger(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error(`Error in PDFViewer listener for "${event}":`, e);
        }
      });
    }
  }

  /**
   * Load PDF document from Source
   * @param {ArrayBuffer|string|Uint8Array} src Can be PDF binary data or a URL/File Path
   * @returns {Promise<pdfjsLib.PDFDocumentProxy>}
   */
  async loadDocument(src) {
    try {
      this.destroy(); // Clear existing document

      let loadingTask;
      if (src instanceof ArrayBuffer || ArrayBuffer.isView(src)) {
        this.pdfBytes = src instanceof ArrayBuffer ? src : src.buffer;
        loadingTask = pdfjsLib.getDocument({
          data: src,
          cMapUrl: 'node_modules/pdfjs-dist/cmaps/',
          cMapPacked: true,
        });
      } else {
        loadingTask = pdfjsLib.getDocument({
          url: src,
          cMapUrl: 'node_modules/pdfjs-dist/cmaps/',
          cMapPacked: true,
        });
      }

      this.pdfDoc = await loadingTask.promise;
      
      this._trigger('documentLoaded', this.pdfDoc);
      await this.renderAllPages();
      return this.pdfDoc;
    } catch (error) {
      this._trigger('error', error);
      throw error;
    }
  }

  /**
   * Render all pages in the PDF document
   */
  async renderAllPages() {
    if (!this.pdfDoc) return;
    
    // Clear container
    this.containerEl.innerHTML = '';
    this.pages = [];

    const numPages = this.pdfDoc.numPages;
    for (let i = 1; i <= numPages; i++) {
      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'pdf-page-wrapper';
      pageWrapper.dataset.pageNumber = i;
      pageWrapper.style.position = 'relative';
      pageWrapper.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
      pageWrapper.style.backgroundColor = '#ffffff';
      pageWrapper.style.boxSizing = 'border-box';
      
      // Canvas for rendering PDF page
      const pdfCanvas = document.createElement('canvas');
      pdfCanvas.className = 'pdf-canvas';
      pdfCanvas.style.display = 'block';
      pageWrapper.appendChild(pdfCanvas);

      // Canvas placeholder for editor overlay (will be initialized by pdf-editor.js)
      const annotationCanvas = document.createElement('canvas');
      annotationCanvas.className = 'annotation-canvas';
      annotationCanvas.style.position = 'absolute';
      annotationCanvas.style.top = '0';
      annotationCanvas.style.left = '0';
      annotationCanvas.style.pointerEvents = 'none'; // Set pointer-events to none initially so it doesn't block scroll
      pageWrapper.appendChild(annotationCanvas);

      this.containerEl.appendChild(pageWrapper);

      this.pages.push({
        pageNumber: i,
        wrapper: pageWrapper,
        pdfCanvas: pdfCanvas,
        annotationCanvas: annotationCanvas,
        renderTask: null,
        pdfPage: null
      });
    }

    // Sequentially render pages to avoid over-blocking main thread
    for (const pageData of this.pages) {
      await this.renderPage(pageData.pageNumber);
    }
  }

  /**
   * Render a single page by its page number
   * @param {number} pageNumber 1-indexed page number
   */
  async renderPage(pageNumber) {
    const pageData = this.pages.find(p => p.pageNumber === pageNumber);
    if (!pageData || !this.pdfDoc) return;

    try {
      // Cancel active render task if any
      if (pageData.renderTask) {
        pageData.renderTask.cancel();
        pageData.renderTask = null;
      }

      // Fetch PDF page proxy if not cached
      if (!pageData.pdfPage) {
        pageData.pdfPage = await this.pdfDoc.getPage(pageNumber);
      }

      const page = pageData.pdfPage;
      const viewport = page.getViewport({ scale: this.scale, rotation: this.rotation });

      // Match dimensions
      const width = viewport.width;
      const height = viewport.height;

      pageData.wrapper.style.width = `${width}px`;
      pageData.wrapper.style.height = `${height}px`;

      const pdfCanvas = pageData.pdfCanvas;
      const context = pdfCanvas.getContext('2d');
      
      // Support HiDPI / Retina displays
      const dpr = window.devicePixelRatio || 1;
      pdfCanvas.width = width * dpr;
      pdfCanvas.height = height * dpr;
      pdfCanvas.style.width = `${width}px`;
      pdfCanvas.style.height = `${height}px`;
      
      context.scale(dpr, dpr);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        enableWebGL: true,
        renderInteractiveForms: this.options.renderInteractiveForms
      };

      pageData.renderTask = page.render(renderContext);
      await pageData.renderTask.promise;
      pageData.renderTask = null;

      // Trigger custom rendered event
      this._trigger('pageRendered', {
        pageNumber,
        viewport,
        width,
        height,
        wrapper: pageData.wrapper,
        pdfCanvas: pageData.pdfCanvas,
        annotationCanvas: pageData.annotationCanvas
      });

    } catch (err) {
      if (err.name === 'RenderingCancelledException' || err.message === 'Rendering cancelled, page-number: ' + pageNumber) {
        // Safe to ignore cancellation
        return;
      }
      this._trigger('error', err);
      console.error(`Error rendering page ${pageNumber}:`, err);
    }
  }

  /**
   * Set Zoom Scale
   * @param {number} newScale 
   */
  async setZoom(newScale) {
    const targetScale = Math.max(this.options.minScale, Math.min(this.options.maxScale, newScale));
    if (this.scale === targetScale) return;

    this.scale = targetScale;
    this._trigger('zoomChanged', this.scale);

    // Re-render pages with the new scale
    for (const pageData of this.pages) {
      await this.renderPage(pageData.pageNumber);
    }
  }

  /**
   * Zoom In
   */
  zoomIn() {
    this.setZoom(this.scale + this.options.scaleStep);
  }

  /**
   * Zoom Out
   */
  zoomOut() {
    this.setZoom(this.scale - this.options.scaleStep);
  }

  /**
   * Zoom pages to fit the container width
   */
  zoomToWidth() {
    if (this.pages.length === 0) return;
    const firstPage = this.pages[0];
    if (!firstPage.pdfPage) return;

    // Get unscaled page size
    const viewport = firstPage.pdfPage.getViewport({ scale: 1, rotation: this.rotation });
    const containerWidth = this.containerEl.clientWidth - 60; // Padding offset
    const newScale = containerWidth / viewport.width;
    this.setZoom(newScale);
  }

  /**
   * Zoom pages to fit the container viewport completely
   */
  zoomToFit() {
    if (this.pages.length === 0) return;
    const firstPage = this.pages[0];
    if (!firstPage.pdfPage) return;

    const viewport = firstPage.pdfPage.getViewport({ scale: 1, rotation: this.rotation });
    const containerWidth = this.containerEl.clientWidth - 60;
    const containerHeight = this.containerEl.clientHeight - 60;

    const scaleWidth = containerWidth / viewport.width;
    const scaleHeight = containerHeight / viewport.height;
    const newScale = Math.min(scaleWidth, scaleHeight);
    
    this.setZoom(newScale);
  }

  /**
   * Set page rotation
   * @param {number} angle 0, 90, 180, 270 
   */
  async setRotation(angle) {
    const targetRotation = (angle % 360 + 360) % 360;
    if (this.rotation === targetRotation) return;

    this.rotation = targetRotation;
    this._trigger('rotationChanged', this.rotation);

    for (const pageData of this.pages) {
      await this.renderPage(pageData.pageNumber);
    }
  }

  /**
   * Rotate pages clockwise (90deg)
   */
  rotateClockwise() {
    this.setRotation(this.rotation + 90);
  }

  /**
   * Rotate pages counter-clockwise (90deg)
   */
  rotateCounterClockwise() {
    this.setRotation(this.rotation - 90);
  }

  /**
   * Get active page count
   * @returns {number}
   */
  getPageCount() {
    return this.pdfDoc ? this.pdfDoc.numPages : 0;
  }

  /**
   * Clean up resources
   */
  destroy() {
    // Cancel all active render tasks
    for (const pageData of this.pages) {
      if (pageData.renderTask) {
        pageData.renderTask.cancel();
      }
    }
    
    this.pages = [];
    this.pdfDoc = null;
    this.pdfBytes = null;
    this.containerEl.innerHTML = '';
  }
}

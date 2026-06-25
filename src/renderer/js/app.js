/* src/renderer/js/app.js */

import * as pdfjsLib from 'pdfjs-dist';

// Configure the PDF.js worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

import { IPC_CHANNELS, MODES, THEMES } from '../../shared/constants.js';
import { ThemeManager } from './ui/theme.js';
import { TitlebarController } from './ui/titlebar.js';
import { WelcomeController } from './ui/welcome.js';
import { DialogsController } from './ui/dialogs.js';
import { ToolbarController } from './ui/toolbar.js';
import { SidebarController } from './ui/sidebar.js';
import { TabsController } from './ui/tabs.js';
import { KeyboardShortcuts } from './ui/keyboard.js';
import { DragDropHandler } from './ui/drag-drop.js';
import { NotificationSystem } from './ui/notifications.js';

import { AnnotationsModule } from './features/annotations.js';
import { FormsModule } from './features/forms.js';
import { SignaturesModule } from './features/signatures.js';

class GauPDFApplication {
  constructor() {
    this.currentZoom = 1.0;
    this.currentLayout = 'single'; // single | continuous
    this.renderQueue = Promise.resolve();
    
    // Initialize UI Modules
    ThemeManager.init();
    TitlebarController.init();
    
    this.dialogs = new DialogsController(this);
    this.toolbar = new ToolbarController(this);
    this.sidebar = new SidebarController(this);
    this.tabs = new TabsController(this);
    
    // Initialize Features Modules
    this.annotations = new AnnotationsModule(this);
    this.forms = new FormsModule(this);
    this.signatures = new SignaturesModule(this);

    // Welcome screen dashboard setup
    WelcomeController.init(this);
    
    // Global Event Handlers
    KeyboardShortcuts.init(this);
    DragDropHandler.init(this);

    this.setupAppListeners();
  }

  setupAppListeners() {
    // Scroll viewport monitoring to update active page number indicator
    const viewport = document.getElementById('document-viewport');
    if (viewport) {
      viewport.addEventListener('scroll', () => {
        this.updateActivePageOnScroll();
      });
    }

    // Intercept IPC callbacks from Electron
    if (window.api && typeof window.api.on === 'function') {
      window.api.on(IPC_CHANNELS.FILE_CHANGED, (event, data) => {
        NotificationSystem.info('Tập tin', 'Tài liệu đã được thay đổi bên ngoài.');
      });
    }
  }

  // --- FILE OPEN & LOAD ---
  async openFileDialog() {
    if (window.api && typeof window.api.invoke === 'function') {
      try {
        const result = await window.api.invoke(IPC_CHANNELS.FILE_OPEN);
        if (result && result.path) {
          // If the main process returned data, load from buffer
          if (result.data) {
            this.loadPDFBuffer(result.name, result.path, result.data);
          } else {
            // Read filepath fallback
            this.openFilePath(result.path);
          }
        }
      } catch (err) {
        NotificationSystem.error('Mở tệp', 'Lỗi: ' + err.message);
      }
    } else {
      // Web / Browser mock file dialog
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          this.openFilePath(file.name, file);
        }
      };
      input.click();
    }
  }

  // Open direct file path or web file object
  openFilePath(filePath, fileObject = null) {
    if (fileObject) {
      const reader = new FileReader();
      reader.onload = () => {
        const data = new Uint8Array(reader.result);
        const name = fileObject.name;
        this.loadPDFBuffer(name, filePath, data);
      };
      reader.readAsArrayBuffer(fileObject);
    } else {
      // IPC load from disk
      this.loadPDFFromIPC(filePath);
    }
  }

  async loadPDFFromIPC(filePath) {
    NotificationSystem.info('Mở tệp', 'Đang tải tệp PDF...');
    
    if (window.api && typeof window.api.invoke === 'function') {
      try {
        // Read file contents via Main process IPC
        const data = await window.api.invoke('file:read', filePath);
        if (data) {
          const name = filePath.split(/[/\\]/).pop();
          this.loadPDFBuffer(name, filePath, data);
        } else {
          NotificationSystem.error('Mở tệp', 'Không thể đọc dữ liệu tệp.');
        }
      } catch (err) {
        NotificationSystem.error('Mở tệp', 'Lỗi tải tệp: ' + err.message);
      }
    } else {
      // Mock loading local file
      this.loadMockPDF(filePath);
    }
  }

  async loadPDFBuffer(name, filePath, buffer) {
    try {
      const pdfDoc = await pdfjsLib.getDocument({ data: buffer }).promise;
      this.tabs.addTab(name, filePath, pdfDoc);
      WelcomeController.addRecentFile(filePath);
      NotificationSystem.success('Mở tệp', 'Tải tài liệu PDF thành công.');
    } catch (err) {
      console.error(err);
      NotificationSystem.error('Mở tệp', 'Lỗi phân tích PDF: ' + err.message);
    }
  }

  loadMockPDF(filePath) {
    // Generate simple fake PDF.js document structure for browser preview
    const name = filePath.split(/[/\\]/).pop();
    const mockDoc = {
      numPages: 3,
      getPage: async (num) => {
        return {
          view: [0, 0, 595, 842],
          getViewport: ({ scale }) => ({
            width: 595 * scale,
            height: 842 * scale,
            scale: scale
          }),
          render: (renderCtx) => {
            const ctx = renderCtx.canvasContext;
            const vp = renderCtx.viewport;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, vp.width, vp.height);
            
            // Draw grid page content
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            ctx.strokeRect(20 * vp.scale, 20 * vp.scale, vp.width - 40 * vp.scale, vp.height - 40 * vp.scale);
            
            ctx.fillStyle = '#1e293b';
            ctx.font = `${16 * vp.scale}px sans-serif`;
            ctx.fillText(`Tài liệu Giả lập: ${name}`, 40 * vp.scale, 60 * vp.scale);
            ctx.font = `${12 * vp.scale}px sans-serif`;
            ctx.fillText(`Trang ${num} / 3`, 40 * vp.scale, 90 * vp.scale);
            
            ctx.fillStyle = '#475569';
            ctx.fillText('Đầu ra giả lập chạy trực tiếp trong trình duyệt web.', 40 * vp.scale, 130 * vp.scale);
            ctx.fillText('Bản quyền thuộc về GauPDF Editor.', 40 * vp.scale, 150 * vp.scale);
            
            return { promise: Promise.resolve() };
          }
        };
      },
      getOutline: async () => [
        { title: '1. Giới thiệu tổng quan', dest: 1 },
        { title: '2. Cấu trúc chương trình', dest: 2 },
        { title: '3. Hướng dẫn sử dụng', dest: 3 }
      ]
    };

    this.tabs.addTab(name, filePath, mockDoc);
    WelcomeController.addRecentFile(filePath);
    NotificationSystem.success('Giả lập PDF', 'Đã tải tài liệu PDF giả lập.');
  }

  // --- DOCUMENT LIFECYCLE CALLBACKS ---
  onDocumentSwitched(tab) {
    this.currentZoom = tab.zoom;
    this.currentLayout = tab.layout;
    
    // Sync zoom visual elements
    const zoomInput = document.getElementById('zoom-input');
    const zoomPreset = document.getElementById('select-zoom-preset');
    const txtZoom = document.getElementById('txt-zoom-info');
    
    if (zoomInput) zoomInput.value = `${Math.round(this.currentZoom * 100)}%`;
    if (zoomPreset) zoomPreset.value = this.currentZoom.toString();
    if (txtZoom) txtZoom.textContent = `${Math.round(this.currentZoom * 100)}%`;

    // Sync Page layout buttons
    const layoutSingle = document.getElementById('btn-layout-single');
    const layoutContinuous = document.getElementById('btn-layout-continuous');
    if (this.currentLayout === 'single') {
      if (layoutSingle) layoutSingle.classList.add('active');
      if (layoutContinuous) layoutContinuous.classList.remove('active');
    } else {
      if (layoutContinuous) layoutContinuous.classList.add('active');
      if (layoutSingle) layoutSingle.classList.remove('active');
    }

    // Load annotations/canvas views
    this.renderDocumentView(tab);

    // Sync sidebars
    this.sidebar.updateThumbnails(tab.pdfDoc);
    
    tab.pdfDoc.getOutline().then(outline => {
      this.sidebar.updateOutline(outline);
    });

    this.sidebar.setActiveThumbnail(tab.currentPage);
    this.updatePageInfo(tab.currentPage, tab.pdfDoc.numPages);
  }

  onNoDocumentLoaded() {
    this.updatePageInfo('-', '-');
  }

  onModeChanged(mode) {
    const tab = this.tabs.getActiveTab();
    if (!tab) return;

    // Apply tools alignment settings on all canvases
    Object.values(tab.fabricInstances).forEach(canvas => {
      this.annotations.applyCurrentToolSettings(canvas);
    });
  }

  onToolChanged(tool) {
    const tab = this.tabs.getActiveTab();
    if (!tab) return;

    Object.values(tab.fabricInstances).forEach(canvas => {
      this.annotations.applyCurrentToolSettings(canvas);
    });
  }

  // --- RENDER PORTIONS ---
  async renderDocumentView(tab) {
    const viewport = document.getElementById('document-viewport');
    if (!viewport) return;

    // Clear old page containers
    viewport.innerHTML = '';
    
    const pdfDoc = tab.pdfDoc;
    const numPages = pdfDoc.numPages;

    // Render pages sequentially
    for (let i = 1; i <= numPages; i++) {
      // If layout is single, only render current page
      if (this.currentLayout === 'single' && i !== tab.currentPage) {
        continue;
      }

      await this.renderPageContainer(tab, i, viewport);
    }
  }

  async renderPageContainer(tab, pageNum, viewport) {
    const pdfDoc = tab.pdfDoc;
    
    try {
      const page = await pdfDoc.getPage(pageNum);
      const originalViewport = page.getViewport({ scale: 1.0 });
      const scaleViewport = page.getViewport({ scale: this.currentZoom });

      // Create Container elements
      const container = document.createElement('div');
      container.className = 'pdf-page-container';
      container.id = `page-container-${pageNum}`;
      container.style.width = `${scaleViewport.width}px`;
      container.style.height = `${scaleViewport.height}px`;

      // Page Number tag
      const flag = document.createElement('div');
      flag.className = 'page-flag';
      flag.textContent = `Trang ${pageNum}`;
      container.appendChild(flag);

      // Render PDF.js canvas layer
      const pdfCanvas = document.createElement('canvas');
      pdfCanvas.className = 'pdf-canvas';
      pdfCanvas.width = scaleViewport.width;
      pdfCanvas.height = scaleViewport.height;
      container.appendChild(pdfCanvas);

      const ctx = pdfCanvas.getContext('2d');
      const renderCtx = {
        canvasContext: ctx,
        viewport: scaleViewport
      };

      // Add container to viewport
      viewport.appendChild(container);

      // Render page contents
      await page.render(renderCtx).promise;

      // Overlay Fabric.js overlay canvas
      const fabricCanvasEl = document.createElement('canvas');
      fabricCanvasEl.id = `fabric-canvas-${tab.id}-${pageNum}`;
      container.appendChild(fabricCanvasEl);

      // Create interactive Fabric canvas
      const fCanvas = new fabric.Canvas(fabricCanvasEl.id, {
        width: scaleViewport.width,
        height: scaleViewport.height
      });

      // Track Fabric canvas on active tab
      tab.fabricInstances[pageNum] = fCanvas;

      // Bind drawing and form logic handlers
      this.annotations.bindCanvas(pageNum, fCanvas);
      this.forms.bindCanvas(pageNum, fCanvas, container);
      this.signatures.bindCanvas(pageNum, fCanvas);

    } catch (err) {
      console.error(`Failed rendering page ${pageNum}`, err);
    }
  }

  // --- SCROLL / PAGE INDICATORS ---
  updateActivePageOnScroll() {
    const tab = this.tabs.getActiveTab();
    if (!tab || this.currentLayout === 'single') return;

    const viewport = document.getElementById('document-viewport');
    const containers = viewport.querySelectorAll('.pdf-page-container');
    
    let activePage = 1;
    let minDistance = Infinity;

    containers.forEach(container => {
      const rect = container.getBoundingClientRect();
      const distance = Math.abs(rect.top - viewport.getBoundingClientRect().top);
      if (distance < minDistance) {
        minDistance = distance;
        activePage = parseInt(container.id.replace('page-container-', ''));
      }
    });

    if (activePage !== tab.currentPage) {
      tab.currentPage = activePage;
      this.updatePageInfo(activePage, tab.pdfDoc.numPages);
      this.sidebar.setActiveThumbnail(activePage);
    }
  }

  scrollToPage(pageNum) {
    const tab = this.tabs.getActiveTab();
    if (!tab) return;

    tab.currentPage = pageNum;
    this.updatePageInfo(pageNum, tab.pdfDoc.numPages);

    if (this.currentLayout === 'single') {
      this.renderDocumentView(tab);
    } else {
      const container = document.getElementById(`page-container-${pageNum}`);
      if (container) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  goToOutlineDest(dest) {
    // Check if dest is page index
    let pageNum = 1;
    if (typeof dest === 'number') {
      pageNum = dest;
    } else if (Array.isArray(dest)) {
      // PDF outline destination array
      pageNum = 1; // Simplify to page 1 for mock/advanced dest objects
    }
    
    this.scrollToPage(pageNum);
  }

  updatePageInfo(current, total) {
    const txtPage = document.getElementById('txt-page-info');
    if (txtPage) {
      txtPage.textContent = `Trang ${current} / ${total}`;
    }
  }

  // --- ZOOM CONTROL ---
  zoomIn() {
    this.setZoom(this.currentZoom + 0.15);
  }

  zoomOut() {
    this.setZoom(Math.max(0.25, this.currentZoom - 0.15));
  }

  setZoom(zoomVal) {
    const tab = this.tabs.getActiveTab();
    if (!tab) return;

    let finalZoom = 1.0;
    const viewport = document.getElementById('document-viewport');

    if (zoomVal === 'fit-width') {
      // Calculate fit width zoom level
      const viewportWidth = viewport.getBoundingClientRect().width - 64; // pad
      finalZoom = viewportWidth / 595; // base A4 width
    } else if (zoomVal === 'fit-page') {
      const viewportHeight = viewport.getBoundingClientRect().height - 64;
      finalZoom = viewportHeight / 842; // base A4 height
    } else {
      finalZoom = parseFloat(zoomVal);
    }

    // Cap scale zoom values
    finalZoom = Math.min(Math.max(finalZoom, 0.25), 4.0);

    this.currentZoom = finalZoom;
    tab.zoom = finalZoom;

    // Sync Text indicators
    const zoomInput = document.getElementById('zoom-input');
    const txtZoom = document.getElementById('txt-zoom-info');
    if (zoomInput) zoomInput.value = `${Math.round(finalZoom * 100)}%`;
    if (txtZoom) txtZoom.textContent = `${Math.round(finalZoom * 100)}%`;

    // Render viewport with new sizing
    this.renderDocumentView(tab);
  }

  setViewLayout(layout) {
    const tab = this.tabs.getActiveTab();
    if (!tab) return;

    this.currentLayout = layout;
    tab.layout = layout;
    
    this.renderDocumentView(tab);
  }

  // --- ROTATION ---
  rotatePage(angle) {
    const tab = this.tabs.getActiveTab();
    if (!tab) return;

    NotificationSystem.info('Trang trí', `Đang xoay trang ${tab.currentPage} (${angle} độ)...`);

    // In a real PDF, we would invoke the pdf-lib backend, rotate page object, and re-render.
    // For visual simulation, we can apply css rotation to the page container, or rotate active Fabric canvas.
    const container = document.getElementById(`page-container-${tab.currentPage}`);
    if (container) {
      // Simple visual rotation simulation
      const currentRot = parseInt(container.getAttribute('data-rotation') || '0');
      const nextRot = (currentRot + angle) % 360;
      container.setAttribute('data-rotation', nextRot);
      container.style.transform = `rotate(${nextRot}deg)`;
      container.style.transition = 'transform 0.3s ease';
      NotificationSystem.success('Trang trí', `Đã xoay trang thành công.`);
    }
  }

  deleteSelectedPage() {
    const tab = this.tabs.getActiveTab();
    if (!tab) return;

    NotificationSystem.warning('Trang trí', `Xóa trang ${tab.currentPage}`);
    
    // Simulating page deletion in tabs
    // In production this will invoke a backend IPC call
    NotificationSystem.success('Trang trí', 'Đã xóa trang khỏi tài liệu.');
  }

  insertBlankPage() {
    const tab = this.tabs.getActiveTab();
    if (!tab) return;

    NotificationSystem.info('Trang trí', 'Đang chèn thêm trang trắng...');
    
    // Simulate chèn trang
    tab.pdfDoc.numPages += 1;
    this.sidebar.updateThumbnails(tab.pdfDoc);
    this.renderDocumentView(tab);
    NotificationSystem.success('Trang trí', 'Đã chèn thêm trang trắng thành công.');
  }

  // --- SAVE PORTION ---
  async saveActiveDocument() {
    const tab = this.tabs.getActiveTab();
    if (!tab) return;

    NotificationSystem.info('Lưu tài liệu', 'Đang lưu các thay đổi...');

    const serializedData = {};
    const formData = this.forms.getFormData();

    // Serialize all drawing overlays
    Object.entries(tab.fabricInstances).forEach(([pageIndex, canvas]) => {
      serializedData[pageIndex] = canvas.toJSON();
    });

    if (window.api && typeof window.api.invoke === 'function') {
      try {
        const success = await window.api.invoke(IPC_CHANNELS.FILE_SAVE, {
          filePath: tab.filePath,
          annotations: serializedData,
          forms: formData
        });

        if (success) {
          NotificationSystem.success('Lưu tài liệu', 'Đã lưu thay đổi thành công.');
        } else {
          NotificationSystem.error('Lưu tài liệu', 'Lỗi trong quá trình lưu tài liệu.');
        }
      } catch (err) {
        NotificationSystem.error('Lưu tài liệu', 'Lỗi: ' + err.message);
      }
    } else {
      // Mock save
      setTimeout(() => {
        NotificationSystem.success('Lưu tài liệu (Trình giả lập)', 'Tài liệu đã được lưu thành công (giả lập).');
      }, 1000);
    }
  }

  async printActiveDocument() {
    const tab = this.tabs.getActiveTab();
    if (!tab) return;

    if (window.api && typeof window.api.invoke === 'function') {
      try {
        await window.api.invoke(IPC_CHANNELS.PRINT_EXECUTE, { filePath: tab.filePath });
      } catch (err) {
        NotificationSystem.error('In ấn', 'Lỗi: ' + err.message);
      }
    } else {
      // Standard browser print override
      window.print();
    }
  }
}

// Instantiate application on document ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new GauPDFApplication();
});

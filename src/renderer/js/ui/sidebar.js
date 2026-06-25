/* src/renderer/js/ui/sidebar.js */

export class SidebarController {
  constructor(appInstance) {
    this.appInstance = appInstance;
    this.init();
  }

  init() {
    // Left Sidebar Toggle Buttons
    const btnToggleLeft = document.getElementById('btn-toggle-left-sidebar');
    const btnCloseLeft = document.getElementById('btn-close-left-sidebar');
    const leftSidebar = document.getElementById('left-sidebar');

    if (btnToggleLeft) {
      btnToggleLeft.addEventListener('click', () => {
        leftSidebar.classList.toggle('collapsed');
        btnToggleLeft.classList.toggle('active', !leftSidebar.classList.contains('collapsed'));
      });
    }

    if (btnCloseLeft) {
      btnCloseLeft.addEventListener('click', () => {
        leftSidebar.classList.add('collapsed');
        if (btnToggleLeft) btnToggleLeft.classList.remove('active');
      });
    }

    // Right Sidebar Toggle Buttons
    const btnToggleRight = document.getElementById('btn-toggle-right-sidebar');
    const btnCloseRight = document.getElementById('btn-close-right-sidebar');
    const rightSidebar = document.getElementById('right-sidebar');

    if (btnToggleRight) {
      btnToggleRight.addEventListener('click', () => {
        rightSidebar.classList.toggle('collapsed');
        btnToggleRight.classList.toggle('active', !rightSidebar.classList.contains('collapsed'));
      });
    }

    if (btnCloseRight) {
      btnCloseRight.addEventListener('click', () => {
        rightSidebar.classList.add('collapsed');
        if (btnToggleRight) btnToggleRight.classList.remove('active');
      });
    }

    // Left Sidebar Navigation tabs (Thumbnails vs Outline)
    const tabThumbnails = document.getElementById('tab-btn-thumbnails');
    const tabOutline = document.getElementById('tab-btn-outline');
    const panelThumbnails = document.getElementById('left-sidebar-thumbnails');
    const panelOutline = document.getElementById('left-sidebar-outline');

    if (tabThumbnails && tabOutline) {
      tabThumbnails.addEventListener('click', () => {
        tabThumbnails.classList.add('active');
        tabOutline.classList.remove('active');
        panelThumbnails.style.display = 'flex';
        panelOutline.style.display = 'none';
      });

      tabOutline.addEventListener('click', () => {
        tabOutline.classList.add('active');
        tabThumbnails.classList.remove('active');
        panelOutline.style.display = 'block';
        panelThumbnails.style.display = 'none';
      });
    }

    // Resizer logic
    this.setupResizer('left');
    this.setupResizer('right');
  }

  // Double slider / splitter drag resize logic
  setupResizer(side) {
    const sidebar = document.getElementById(`${side}-sidebar`);
    const resizer = sidebar.querySelector('.sidebar-resizer');
    if (!resizer) return;

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = sidebar.getBoundingClientRect().width;
      
      document.body.style.cursor = 'col-resize';
      // Disable text selections while dragging
      document.body.style.userSelect = 'none';

      const doDrag = (dragEv) => {
        if (!isResizing) return;
        const deltaX = dragEv.clientX - startX;
        let newWidth = side === 'left' ? startWidth + deltaX : startWidth - deltaX;

        // Min/max caps
        if (newWidth < 180) newWidth = 180;
        if (newWidth > 380) newWidth = 380;

        sidebar.style.width = `${newWidth}px`;
      };

      const stopDrag = () => {
        isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', doDrag);
        window.removeEventListener('mouseup', stopDrag);
      };

      window.addEventListener('mousemove', doDrag);
      window.addEventListener('mouseup', stopDrag);
    });
  }

  // Left sidebar rendered thumbnail update
  updateThumbnails(pdfDoc) {
    const listEl = document.getElementById('left-sidebar-thumbnails');
    if (!listEl) return;

    listEl.innerHTML = '';
    
    // Draw page thumbnails
    const numPages = pdfDoc.numPages;
    for (let i = 1; i <= numPages; i++) {
      const item = document.createElement('div');
      item.className = 'thumbnail-item';
      item.setAttribute('data-page', i);
      
      const wrapper = document.createElement('div');
      wrapper.className = 'thumbnail-wrapper';
      
      const canvas = document.createElement('canvas');
      wrapper.appendChild(canvas);
      item.appendChild(wrapper);

      const pageNum = document.createElement('span');
      pageNum.className = 'thumbnail-num';
      pageNum.textContent = `Trang ${i}`;
      item.appendChild(pageNum);

      // Drag handles for Organize page order swaps
      const dragHandle = document.createElement('div');
      dragHandle.className = 'drag-handle';
      dragHandle.innerHTML = '⋮⋮';
      item.appendChild(dragHandle);

      // Click to scroll to page container
      item.addEventListener('click', () => {
        this.appInstance.scrollToPage(i);
        this.setActiveThumbnail(i);
      });

      listEl.appendChild(item);

      // Render thumbnail asynchronously using PDF.js
      this.renderThumbnailCanvas(pdfDoc, i, canvas);
    }
  }

  async renderThumbnailCanvas(pdfDoc, pageNum, canvas) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.2 }); // low scale thumbnail
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderCtx = {
        canvasContext: ctx,
        viewport: viewport
      };

      await page.render(renderCtx).promise;
    } catch (err) {
      console.error(`Error rendering thumbnail page ${pageNum}`, err);
    }
  }

  setActiveThumbnail(pageNum) {
    document.querySelectorAll('.thumbnail-item').forEach(item => {
      const p = parseInt(item.getAttribute('data-page'));
      if (p === pageNum) {
        item.classList.add('active');
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        item.classList.remove('active');
      }
    });
  }

  updateOutline(outline) {
    const listEl = document.getElementById('left-sidebar-outline');
    if (!listEl) return;

    if (!outline || outline.length === 0) {
      listEl.innerHTML = '<div class="properties-empty"><span>Tài liệu không có mục lục.</span></div>';
      return;
    }

    listEl.innerHTML = '';
    const renderNode = (nodes, container) => {
      const ul = document.createElement('ul');
      ul.style.listStyle = 'none';
      ul.style.paddingLeft = '12px';

      nodes.forEach(node => {
        const li = document.createElement('li');
        
        const item = document.createElement('div');
        item.className = 'outline-item';
        item.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          <span>${node.title}</span>
        `;
        
        item.addEventListener('click', () => {
          // Resolve outline destination (usually index/page ref)
          if (node.dest) {
            this.appInstance.goToOutlineDest(node.dest);
          }
        });

        li.appendChild(item);
        
        if (node.items && node.items.length > 0) {
          renderNode(node.items, li);
        }

        ul.appendChild(li);
      });
      container.appendChild(ul);
    };

    renderNode(outline, listEl);
  }

  // --- PROPERTIES PANEL (Right Sidebar) ---
  showProperties(type, object, onUpdateCallback) {
    const panel = document.getElementById('properties-panel-content');
    if (!panel) return;

    // Expand sidebar if collapsed
    const rightSidebar = document.getElementById('right-sidebar');
    const btnToggleRight = document.getElementById('btn-toggle-right-sidebar');
    if (rightSidebar.classList.contains('collapsed')) {
      rightSidebar.classList.remove('collapsed');
      if (btnToggleRight) btnToggleRight.classList.add('active');
    }

    if (type === 'text') {
      panel.innerHTML = `
        <div class="properties-group">
          <div class="properties-title">Văn bản</div>
          <div class="property-row">
            <span class="property-label">Cỡ chữ:</span>
            <input type="number" id="prop-font-size" class="toolbar-number-input" value="${object.fontSize || 12}" min="6" max="72">
          </div>
          <div class="property-row">
            <span class="property-label">Màu sắc:</span>
            <input type="color" id="prop-text-color" value="${object.fill || '#000000'}">
          </div>
          <div class="property-row">
            <span class="property-label">Độ mờ đục:</span>
            <input type="range" id="prop-opacity" min="10" max="100" value="${(object.opacity || 1) * 100}">
          </div>
        </div>
      `;

      // Wire changes
      document.getElementById('prop-font-size').addEventListener('input', (e) => {
        onUpdateCallback({ fontSize: parseInt(e.target.value) });
      });
      document.getElementById('prop-text-color').addEventListener('change', (e) => {
        onUpdateCallback({ fill: e.target.value });
      });
      document.getElementById('prop-opacity').addEventListener('input', (e) => {
        onUpdateCallback({ opacity: parseInt(e.target.value) / 100 });
      });

    } else if (type === 'drawing') {
      panel.innerHTML = `
        <div class="properties-group">
          <div class="properties-title">Nét vẽ tự do</div>
          <div class="property-row">
            <span class="property-label">Độ dày:</span>
            <input type="number" id="prop-stroke-width" class="toolbar-number-input" value="${object.strokeWidth || 3}" min="1" max="24">
          </div>
          <div class="property-row">
            <span class="property-label">Màu nét:</span>
            <input type="color" id="prop-stroke-color" value="${object.stroke || '#6366f1'}">
          </div>
        </div>
      `;

      // Wire changes
      document.getElementById('prop-stroke-width').addEventListener('input', (e) => {
        onUpdateCallback({ strokeWidth: parseInt(e.target.value) });
      });
      document.getElementById('prop-stroke-color').addEventListener('change', (e) => {
        onUpdateCallback({ stroke: e.target.value });
      });

    } else {
      this.clearProperties();
    }
  }

  clearProperties() {
    const panel = document.getElementById('properties-panel-content');
    if (!panel) return;
    panel.innerHTML = `
      <div class="properties-empty">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>Chọn bất kỳ chú thích hoặc đối tượng văn bản nào để chỉnh sửa thuộc tính.</span>
      </div>
    `;
  }
}

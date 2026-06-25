/* src/renderer/js/features/forms.js */

export class FormsModule {
  constructor(appInstance) {
    this.appInstance = appInstance;
    this.formFields = []; // Array tracking fields { id, pageIndex, type, x, y, width, height, value }
  }

  // Set up forms mouse listener on Fabric canvas
  bindCanvas(pageIndex, canvas, pageContainer) {
    canvas.on('mouse:down', (options) => {
      const tool = this.appInstance.toolbar.activeTool;
      const pointer = canvas.getPointer(options.e);

      if (tool === 'textfield') {
        this.addField(pageIndex, 'text', pointer.x, pointer.y, pageContainer);
      } else if (tool === 'checkbox') {
        this.addField(pageIndex, 'checkbox', pointer.x, pointer.y, pageContainer);
      }
    });

    // Load any existing fields for this page
    this.renderFormFieldsForPage(pageIndex, pageContainer);
  }

  addField(pageIndex, type, x, y, pageContainer) {
    const fieldId = 'field_' + Math.random().toString(36).substring(2, 9);
    const width = type === 'text' ? 140 : 20;
    const height = type === 'text' ? 24 : 20;

    const newField = {
      id: fieldId,
      pageIndex: pageIndex,
      type: type,
      x: x,
      y: y,
      width: width,
      height: height,
      value: type === 'text' ? '' : false
    };

    this.formFields.push(newField);
    this.renderFieldOverlay(newField, pageContainer);
    
    // Return tool to select
    this.appInstance.toolbar.setTool('select');
  }

  renderFieldOverlay(field, pageContainer) {
    const overlay = document.createElement('div');
    overlay.className = 'form-field-overlay';
    overlay.id = field.id;
    overlay.style.left = `${field.x}px`;
    overlay.style.top = `${field.y}px`;
    overlay.style.width = `${field.width}px`;
    overlay.style.height = `${field.height}px`;

    // Make it draggable / adjustable if in Form edit mode
    let inputEl;
    if (field.type === 'text') {
      inputEl = document.createElement('input');
      inputEl.type = 'text';
      inputEl.value = field.value || '';
      inputEl.placeholder = 'Nhập văn bản...';
      inputEl.addEventListener('input', (e) => {
        field.value = e.target.value;
      });
    } else {
      inputEl = document.createElement('input');
      inputEl.type = 'checkbox';
      inputEl.checked = !!field.value;
      inputEl.addEventListener('change', (e) => {
        field.value = e.target.checked;
      });
    }

    overlay.appendChild(inputEl);
    pageContainer.appendChild(overlay);

    // Context menu / click handlers for form fields to modify properties in right sidebar
    overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showFieldProperties(field, overlay);
    });
  }

  renderFormFieldsForPage(pageIndex, pageContainer) {
    // Clear any existing overlays
    pageContainer.querySelectorAll('.form-field-overlay').forEach(overlay => overlay.remove());

    const pageFields = this.formFields.filter(f => f.pageIndex === pageIndex);
    pageFields.forEach(field => {
      this.renderFieldOverlay(field, pageContainer);
    });
  }

  showFieldProperties(field, overlayEl) {
    const panel = document.getElementById('properties-panel-content');
    if (!panel) return;

    panel.innerHTML = `
      <div class="properties-group">
        <div class="properties-title">Trường biểu mẫu</div>
        <div class="property-row">
          <span class="property-label">ID trường:</span>
          <input type="text" id="form-prop-id" class="form-control" value="${field.id}">
        </div>
        <div class="property-row">
          <span class="property-label">Rộng (px):</span>
          <input type="number" id="form-prop-width" class="toolbar-number-input" value="${field.width}">
        </div>
        <div class="property-row">
          <span class="property-label">Cao (px):</span>
          <input type="number" id="form-prop-height" class="toolbar-number-input" value="${field.height}">
        </div>
        <div style="margin-top: 16px;">
          <button class="btn btn-secondary" id="btn-form-delete-field" style="width: 100%; border-color: var(--danger); color: var(--danger);">Xóa trường</button>
        </div>
      </div>
    `;

    // Bind listeners
    document.getElementById('form-prop-id').addEventListener('input', (e) => {
      field.id = e.target.value;
      overlayEl.id = e.target.value;
    });

    document.getElementById('form-prop-width').addEventListener('input', (e) => {
      const w = parseInt(e.target.value) || 20;
      field.width = w;
      overlayEl.style.width = `${w}px`;
    });

    document.getElementById('form-prop-height').addEventListener('input', (e) => {
      const h = parseInt(e.target.value) || 20;
      field.height = h;
      overlayEl.style.height = `${h}px`;
    });

    document.getElementById('btn-form-delete-field').addEventListener('click', () => {
      this.formFields = this.formFields.filter(f => f.id !== field.id);
      overlayEl.remove();
      this.appInstance.sidebar.clearProperties();
    });
  }

  // Get current form data values for saving/submitting
  getFormData() {
    return this.formFields.map(f => ({
      id: f.id,
      pageIndex: f.pageIndex,
      type: f.type,
      value: f.value
    }));
  }
}

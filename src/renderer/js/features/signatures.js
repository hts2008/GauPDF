/* src/renderer/js/features/signatures.js */

import { NotificationSystem } from '../ui/notifications.js';

export class SignaturesModule {
  constructor(appInstance) {
    this.appInstance = appInstance;
    this.savedSignatureDataUrl = null;
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;
    this.initSignaturePad();
  }

  initSignaturePad() {
    const canvas = document.getElementById('signature-draw-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Signature Pad Mouse/Draw Events
    canvas.addEventListener('mousedown', (e) => {
      this.isDrawing = true;
      const rect = canvas.getBoundingClientRect();
      this.lastX = e.clientX - rect.left;
      this.lastY = e.clientY - rect.top;
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!this.isDrawing) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      ctx.beginPath();
      ctx.moveTo(this.lastX, this.lastY);
      ctx.lineTo(x, y);
      ctx.stroke();

      this.lastX = x;
      this.lastY = y;
    });

    const stopDrawing = () => {
      this.isDrawing = false;
    };

    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    // Color picker brush updates
    const colorPicker = document.getElementById('sig-color-picker');
    if (colorPicker) {
      colorPicker.addEventListener('change', () => {
        ctx.strokeStyle = colorPicker.value;
      });
    }

    // Clear Pad
    const clearBtn = document.getElementById('btn-clear-signature');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
    }

    // Save Signature
    const saveBtn = document.getElementById('btn-save-signature');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        // Verify if drawing pad is empty (we can check if any pixel exists or just assume)
        this.savedSignatureDataUrl = canvas.toDataURL('image/png');
        this.appInstance.dialogs.hide('signature');
        
        NotificationSystem.success('Chữ ký', 'Đã tạo chữ ký. Nhấp vào bất kỳ đâu trên tài liệu để đặt chữ ký.');
        
        // Switch tool in Forms or Comments toolbar to activate stamp placement
        this.appInstance.toolbar.switchMode('forms');
        this.appInstance.toolbar.setTool('signature');
      });
    }
  }

  // Handle signature stamp placement on active Fabric canvas
  bindCanvas(pageIndex, canvas) {
    canvas.on('mouse:down', (options) => {
      const tool = this.appInstance.toolbar.activeTool;
      const pointer = canvas.getPointer(options.e);

      if (tool === 'signature' && this.savedSignatureDataUrl) {
        this.placeSignatureOnCanvas(canvas, pointer.x, pointer.y);
      }
    });
  }

  placeSignatureOnCanvas(canvas, x, y) {
    if (!this.savedSignatureDataUrl) return;

    fabric.Image.fromURL(this.savedSignatureDataUrl, (img) => {
      img.set({
        left: x - 100, // Center relative to width/height
        top: y - 50,
        scaleX: 0.5,
        scaleY: 0.5,
        selectable: true,
        cornerColor: '#6366f1',
        cornerSize: 8,
        transparentCorners: false
      });

      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();

      // Reset tool state to selector
      this.appInstance.toolbar.setTool('select');
    });
  }
}

/* src/renderer/js/ui/dialogs.js */

import { IPC_CHANNELS } from '../../../shared/constants.js';
import { NotificationSystem } from './notifications.js';
import { ThemeManager } from './theme.js';

export class DialogsController {
  constructor(appInstance) {
    this.appInstance = appInstance;
    this.mergeFiles = [];
    this.init();
  }

  init() {
    // Setup general Close actions for dialogs
    document.querySelectorAll('.dialog-backdrop').forEach(dialog => {
      // Close on close button or backdrop click
      const closeBtn = dialog.querySelector('.dialog-close-btn');
      const cancelBtn = dialog.querySelector('.cancel-dialog');
      
      const closeFn = () => this.hide(dialog.id.replace('dialog-', ''));

      if (closeBtn) closeBtn.addEventListener('click', closeFn);
      if (cancelBtn) cancelBtn.addEventListener('click', closeFn);

      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) closeFn();
      });
    });

    // Wire execute actions
    this.setupMergeActions();
    this.setupSplitActions();
    this.setupCompressActions();
    this.setupSettingsActions();
    this.setupOcrActions();
  }

  show(id) {
    const dialog = document.getElementById(`dialog-${id}`);
    if (dialog) {
      dialog.style.display = 'flex';
      // Trigger reflow
      dialog.offsetHeight;
      dialog.classList.add('show');

      // Specific initializers
      if (id === 'settings') {
        this.loadSettingsToForm();
      } else if (id === 'merge') {
        this.resetMergeForm();
      }
    }
  }

  hide(id) {
    const dialog = document.getElementById(`dialog-${id}`);
    if (dialog) {
      dialog.classList.remove('show');
      const transitionEnd = () => {
        dialog.style.display = 'none';
        dialog.removeEventListener('transitionend', transitionEnd);
      };
      dialog.addEventListener('transitionend', transitionEnd);
    }
  }

  // --- SETTINGS DIALOG ---
  loadSettingsToForm() {
    const langSelect = document.getElementById('settings-lang');
    const themeSelect = document.getElementById('settings-theme');
    const autoSaveCheck = document.getElementById('settings-autosave');

    if (langSelect) langSelect.value = localStorage.getItem('gaupdf-lang') || 'vi';
    if (themeSelect) themeSelect.value = ThemeManager.currentTheme;
    if (autoSaveCheck) autoSaveCheck.checked = localStorage.getItem('gaupdf-autosave') !== 'false';
  }

  setupSettingsActions() {
    const btnSaveSettings = document.getElementById('btn-save-settings');
    if (btnSaveSettings) {
      btnSaveSettings.addEventListener('click', () => {
        const lang = document.getElementById('settings-lang').value;
        const theme = document.getElementById('settings-theme').value;
        const autosave = document.getElementById('settings-autosave').checked;

        localStorage.setItem('gaupdf-lang', lang);
        localStorage.setItem('gaupdf-autosave', autosave ? 'true' : 'false');
        
        ThemeManager.setTheme(theme);
        
        this.hide('settings');
        NotificationSystem.success('Cài đặt', 'Đã lưu cấu hình hệ thống thành công.');
      });
    }
  }

  // --- MERGE DIALOG ---
  resetMergeForm() {
    this.mergeFiles = [];
    this.renderMergeFileList();
  }

  setupMergeActions() {
    const dropZone = document.getElementById('merge-drop-zone');
    const btnMerge = document.getElementById('btn-execute-merge');

    if (dropZone) {
      dropZone.addEventListener('click', async () => {
        // Mock file chooser if running in browser, or call open dialog via IPC
        if (window.api && typeof window.api.invoke === 'function') {
          try {
            const files = await window.api.invoke(IPC_CHANNELS.FILE_OPEN, { multi: true });
            if (files && files.length > 0) {
              files.forEach(f => this.addMergeFile(f));
            }
          } catch (err) {
            console.error(err);
          }
        } else {
          // Browser file selector fallback
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = '.pdf';
          input.onchange = (e) => {
            Array.from(e.target.files).forEach(file => {
              this.addMergeFile(file.name, file.name); // Mock path for browser testing
            });
          };
          input.click();
        }
      });

      // Drag and drop in drop zone
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        Array.from(e.dataTransfer.files).forEach(file => {
          if (file.name.endsWith('.pdf')) {
            // Note: in electron, file.path contains the absolute local filepath
            this.addMergeFile(file.path || file.name);
          }
        });
      });
    }

    if (btnMerge) {
      btnMerge.addEventListener('click', async () => {
        if (this.mergeFiles.length < 2) {
          NotificationSystem.warning('Gộp PDF', 'Vui lòng chọn ít nhất 2 file PDF để gộp.');
          return;
        }

        const outName = document.getElementById('merge-output-name').value;
        if (!outName.trim()) {
          NotificationSystem.warning('Gộp PDF', 'Vui lòng nhập tên file kết quả.');
          return;
        }

        btnMerge.disabled = true;
        btnMerge.textContent = 'Đang gộp...';

        const paths = this.mergeFiles.map(f => f.path);
        
        if (window.api && typeof window.api.invoke === 'function') {
          try {
            const success = await window.api.invoke(IPC_CHANNELS.PDF_MERGE, { files: paths, outputName: outName });
            if (success) {
              NotificationSystem.success('Gộp PDF', `Đã gộp thành công thành file: ${outName}`);
              this.hide('merge');
            } else {
              NotificationSystem.error('Gộp PDF', 'Lỗi trong quá trình gộp các tệp PDF.');
            }
          } catch (err) {
            NotificationSystem.error('Gộp PDF', 'Lỗi: ' + err.message);
          }
        } else {
          // Browser mock
          setTimeout(() => {
            NotificationSystem.success('Gộp PDF (Trình giả lập)', `Gộp hoàn thành thành công: ${outName}`);
            this.hide('merge');
          }, 1500);
        }

        btnMerge.disabled = false;
        btnMerge.textContent = 'Bắt đầu gộp';
      });
    }
  }

  addMergeFile(filePath) {
    const fileName = filePath.split(/[/\\]/).pop();
    // Prevent adding duplicates
    if (!this.mergeFiles.some(f => f.path === filePath)) {
      this.mergeFiles.push({ name: fileName, path: filePath });
      this.renderMergeFileList();
    }
  }

  removeMergeFile(index) {
    this.mergeFiles.splice(index, 1);
    this.renderMergeFileList();
  }

  renderMergeFileList() {
    const fileListEl = document.getElementById('merge-file-list');
    if (!fileListEl) return;

    if (this.mergeFiles.length === 0) {
      fileListEl.innerHTML = '';
      return;
    }

    fileListEl.innerHTML = '';
    this.mergeFiles.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'dialog-file-item';
      item.innerHTML = `
        <span class="file-name" title="${file.path}">${index + 1}. ${file.name}</span>
        <span class="remove-file" data-index="${index}">&times;</span>
      `;
      item.querySelector('.remove-file').addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'));
        this.removeMergeFile(idx);
      });
      fileListEl.appendChild(item);
    });
  }

  // --- SPLIT DIALOG ---
  setupSplitActions() {
    const splitModeSelect = document.getElementById('split-mode');
    const splitRangeGroup = document.getElementById('split-range-group');
    const splitNumGroup = document.getElementById('split-number-group');
    const btnSplit = document.getElementById('btn-execute-split');

    if (splitModeSelect) {
      splitModeSelect.addEventListener('change', () => {
        const val = splitModeSelect.value;
        if (val === 'range') {
          splitRangeGroup.style.display = 'block';
          splitNumGroup.style.display = 'none';
        } else if (val === 'equal') {
          splitRangeGroup.style.display = 'none';
          splitNumGroup.style.display = 'block';
        } else {
          splitRangeGroup.style.display = 'none';
          splitNumGroup.style.display = 'none';
        }
      });
    }

    if (btnSplit) {
      btnSplit.addEventListener('click', async () => {
        // Ensure there is a loaded document first
        const activeTab = this.appInstance.tabs.getActiveTab();
        if (!activeTab) {
          NotificationSystem.warning('Chia nhỏ PDF', 'Vui lòng mở một tài liệu PDF trước.');
          this.hide('split');
          return;
        }

        const mode = splitModeSelect.value;
        const range = document.getElementById('split-range-input').value;
        const parts = document.getElementById('split-number-input').value;

        if (mode === 'range' && !range.trim()) {
          NotificationSystem.warning('Chia nhỏ PDF', 'Vui lòng nhập dải trang (Ví dụ: 1-3, 4-6).');
          return;
        }

        btnSplit.disabled = true;
        btnSplit.textContent = 'Đang chia...';

        if (window.api && typeof window.api.invoke === 'function') {
          try {
            const success = await window.api.invoke(IPC_CHANNELS.PDF_SPLIT, {
              filePath: activeTab.filePath,
              mode,
              range,
              parts: parseInt(parts)
            });
            if (success) {
              NotificationSystem.success('Chia nhỏ PDF', 'Tài liệu đã được chia thành công.');
              this.hide('split');
            } else {
              NotificationSystem.error('Chia nhỏ PDF', 'Lỗi trong quá trình phân tách PDF.');
            }
          } catch (err) {
            NotificationSystem.error('Chia nhỏ PDF', 'Lỗi: ' + err.message);
          }
        } else {
          // Browser mock
          setTimeout(() => {
            NotificationSystem.success('Chia nhỏ PDF (Trình giả lập)', 'Tách trang hoàn tất.');
            this.hide('split');
          }, 1500);
        }

        btnSplit.disabled = false;
        btnSplit.textContent = 'Bắt đầu chia';
      });
    }
  }

  // --- COMPRESS DIALOG ---
  setupCompressActions() {
    const btnCompress = document.getElementById('btn-execute-compress');
    if (btnCompress) {
      btnCompress.addEventListener('click', async () => {
        const activeTab = this.appInstance.tabs.getActiveTab();
        if (!activeTab) {
          NotificationSystem.warning('Nén PDF', 'Vui lòng mở một tài liệu PDF trước.');
          this.hide('compress');
          return;
        }

        const level = document.getElementById('compress-level').value;
        btnCompress.disabled = true;
        btnCompress.textContent = 'Đang nén...';

        if (window.api && typeof window.api.invoke === 'function') {
          try {
            const success = await window.api.invoke(IPC_CHANNELS.PDF_COMPRESS, {
              filePath: activeTab.filePath,
              level
            });
            if (success) {
              NotificationSystem.success('Nén PDF', 'Nén giảm dung lượng file PDF hoàn tất.');
              this.hide('compress');
            } else {
              NotificationSystem.error('Nén PDF', 'Lỗi trong quá trình nén dung lượng.');
            }
          } catch (err) {
            NotificationSystem.error('Nén PDF', 'Lỗi: ' + err.message);
          }
        } else {
          // Browser mock
          setTimeout(() => {
            NotificationSystem.success('Nén PDF (Trình giả lập)', 'Tối ưu dung lượng thành công.');
            this.hide('compress');
          }, 1500);
        }

        btnCompress.disabled = false;
        btnCompress.textContent = 'Bắt đầu nén';
      });
    }
  }

  // --- OCR ACTIONS ---
  setupOcrActions() {
    const btnExecuteOcr = document.getElementById('btn-execute-ocr');
    const btnCopy = document.getElementById('btn-ocr-copy');
    
    if (btnExecuteOcr) {
      btnExecuteOcr.addEventListener('click', async () => {
        const activeTab = this.appInstance.tabs.getActiveTab();
        if (!activeTab) {
          NotificationSystem.warning('OCR', 'Vui lòng mở một tài liệu PDF trước.');
          this.hide('ocr');
          return;
        }

        const lang = document.getElementById('ocr-lang-select').value;
        const progressBar = document.getElementById('ocr-progress-bar');
        const progressText = document.getElementById('ocr-status-text');
        const textResult = document.getElementById('ocr-result-text');

        btnExecuteOcr.disabled = true;
        btnExecuteOcr.textContent = 'Đang nhận diện...';
        progressBar.style.width = '0%';
        progressText.textContent = 'Khởi tạo Tesseract OCR...';
        textResult.value = '';
        btnCopy.disabled = true;

        if (window.api && typeof window.api.invoke === 'function') {
          // In electron app, we could execute OCR via worker in main/preload process or locally
          try {
            // Bind listener for OCR status messages
            if (typeof window.api.on === 'function') {
              window.api.on('ocr:status', (event, data) => {
                const percent = Math.round((data.progress || 0) * 100);
                progressBar.style.width = `${percent}%`;
                progressText.textContent = `${data.status || 'Đang quét'} (${percent}%)`;
              });
            }

            const result = await window.api.invoke(IPC_CHANNELS.OCR_EXECUTE, {
              filePath: activeTab.filePath,
              lang
            });

            if (result && result.text) {
              textResult.value = result.text;
              progressBar.style.width = '100%';
              progressText.textContent = 'Hoàn thành trích xuất!';
              btnCopy.disabled = false;
              NotificationSystem.success('OCR', 'Trích xuất văn bản hoàn tất.');
            } else {
              progressText.textContent = 'Không tìm thấy chữ nào.';
              NotificationSystem.warning('OCR', 'Không trích xuất được chữ viết nào.');
            }
          } catch (err) {
            progressText.textContent = 'Lỗi nhận diện.';
            NotificationSystem.error('OCR', 'Lỗi: ' + err.message);
          }
        } else {
          // Mock in browser
          let progress = 0;
          const interval = setInterval(() => {
            progress += 0.1;
            const percent = Math.min(Math.round(progress * 100), 99);
            progressBar.style.width = `${percent}%`;
            progressText.textContent = `Nhận diện trang... (${percent}%)`;
            
            if (progress >= 1.0) {
              clearInterval(interval);
              textResult.value = `[TRÍCH XUẤT OCR GIẢ LẬP]\nTài liệu: ${activeTab.name}\n\nCộng hòa Xã hội Chủ nghĩa Việt Nam\nĐộc lập - Tự do - Hạnh phúc\n\nBIÊN BẢN BÀN GIAO CÔNG VIỆC\n\nTôi tên là Nguyễn Văn A, đã hoàn tất chuyển giao toàn bộ mã nguồn của GauPDF Editor cho đội ngũ kỹ sư. Hệ thống chạy ổn định và đạt tiêu chuẩn chất lượng cao.`;
              progressBar.style.width = '100%';
              progressText.textContent = 'Hoàn thành!';
              btnCopy.disabled = false;
              NotificationSystem.success('OCR (Trình giả lập)', 'Quá trình trích xuất hoàn tất.');
            }
          }, 200);
        }

        btnExecuteOcr.disabled = false;
        btnExecuteOcr.textContent = 'Bắt đầu OCR';
      });
    }

    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        const textResult = document.getElementById('ocr-result-text');
        textResult.select();
        document.execCommand('copy');
        NotificationSystem.success('OCR', 'Đã sao chép văn bản vào Clipboard.');
      });
    }
  }
}

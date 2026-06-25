/* src/renderer/js/ui/tabs.js */

export class TabsController {
  constructor(appInstance) {
    this.appInstance = appInstance;
    this.tabs = []; // List of open document tabs
    this.activeTabId = null;
    this.init();
  }

  init() {
    const addTabBtn = document.getElementById('add-tab-btn');
    if (addTabBtn) {
      addTabBtn.addEventListener('click', () => {
        this.appInstance.openFileDialog();
      });
    }
  }

  addTab(name, filePath, pdfDoc) {
    const tabId = 'tab_' + Math.random().toString(36).substring(2, 9);
    const newTab = {
      id: tabId,
      name: name,
      filePath: filePath,
      pdfDoc: pdfDoc,
      zoom: 1.0,
      layout: 'single', // single | continuous
      currentPage: 1,
      fabricInstances: {} // maps pageIndex -> Fabric canvas instance
    };

    this.tabs.push(newTab);
    this.renderTabs();
    this.switchTab(tabId);
    
    // Enable save button now that file is loaded
    const saveBtn = document.getElementById('btn-save-file');
    const saveAsBtn = document.getElementById('btn-save-as');
    const printBtn = document.getElementById('btn-print-file');
    if (saveBtn) saveBtn.disabled = false;
    if (saveAsBtn) saveAsBtn.disabled = false;
    if (printBtn) printBtn.disabled = false;

    return newTab;
  }

  closeTab(tabId) {
    const index = this.tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;

    // Clean up Fabric canvas instances associated with this tab
    const tabToClose = this.tabs[index];
    if (tabToClose.fabricInstances) {
      Object.values(tabToClose.fabricInstances).forEach(canvas => {
        try { canvas.dispose(); } catch (_) {}
      });
    }

    this.tabs.splice(index, 1);
    this.renderTabs();

    if (this.activeTabId === tabId) {
      if (this.tabs.length > 0) {
        // Switch to adjacent tab
        const nextActiveIdx = Math.max(0, index - 1);
        this.switchTab(this.tabs[nextActiveIdx].id);
      } else {
        this.activeTabId = null;
        // Show Welcome Dashboard
        document.getElementById('welcome-dashboard').style.display = 'flex';
        document.getElementById('document-workspace').style.display = 'none';
        
        // Update Titlebar
        document.querySelector('#titlebar .window-title span').textContent = 'GauPDF Editor';

        // Collapse sidebars
        document.getElementById('left-sidebar').classList.add('collapsed');
        document.getElementById('right-sidebar').classList.add('collapsed');
        
        const btnToggleLeft = document.getElementById('btn-toggle-left-sidebar');
        const btnToggleRight = document.getElementById('btn-toggle-right-sidebar');
        if (btnToggleLeft) btnToggleLeft.classList.remove('active');
        if (btnToggleRight) btnToggleRight.classList.remove('active');

        // Disable save buttons
        const saveBtn = document.getElementById('btn-save-file');
        const saveAsBtn = document.getElementById('btn-save-as');
        const printBtn = document.getElementById('btn-print-file');
        if (saveBtn) saveBtn.disabled = true;
        if (saveAsBtn) saveAsBtn.disabled = true;
        if (printBtn) printBtn.disabled = true;

        this.appInstance.onNoDocumentLoaded();
      }
    }
  }

  switchTab(tabId) {
    const targetTab = this.tabs.find(t => t.id === tabId);
    if (!targetTab) return;

    this.activeTabId = tabId;
    this.renderTabs();

    // Toggle Workspace views
    document.getElementById('welcome-dashboard').style.display = 'none';
    document.getElementById('document-workspace').style.display = 'flex';

    // Show/open sidebars
    const leftSidebar = document.getElementById('left-sidebar');
    leftSidebar.classList.remove('collapsed');
    const btnToggleLeft = document.getElementById('btn-toggle-left-sidebar');
    if (btnToggleLeft) btnToggleLeft.classList.add('active');

    // Update title bar
    document.querySelector('#titlebar .window-title span').textContent = `GauPDF Editor — ${targetTab.name}`;

    // Delegate rendering and view loading
    this.appInstance.onDocumentSwitched(targetTab);
  }

  getActiveTab() {
    return this.tabs.find(t => t.id === this.activeTabId);
  }

  renderTabs() {
    const tabsContainer = document.getElementById('tabs-header');
    if (!tabsContainer) return;

    // Remove existing tabs (leaving the Add Tab button)
    tabsContainer.querySelectorAll('.doc-tab').forEach(t => t.remove());

    const addBtn = document.getElementById('add-tab-btn');

    this.tabs.forEach(tab => {
      const tabEl = document.createElement('div');
      tabEl.className = `doc-tab ${tab.id === this.activeTabId ? 'active' : ''}`;
      
      const tabTitle = document.createElement('span');
      tabTitle.textContent = tab.name;
      tabTitle.title = tab.filePath;
      tabEl.appendChild(tabTitle);

      const closeBtn = document.createElement('span');
      closeBtn.className = 'tab-close';
      closeBtn.innerHTML = '&times;';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeTab(tab.id);
      });

      tabEl.appendChild(closeBtn);

      tabEl.addEventListener('click', () => {
        this.switchTab(tab.id);
      });

      // Insert tab before the "+" button
      tabsContainer.insertBefore(tabEl, addBtn);
    });
  }
}

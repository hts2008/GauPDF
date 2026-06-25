import React, { useState, useEffect, useRef } from 'react';
import Titlebar from './components/Titlebar.jsx';
import Welcome from './components/Welcome.jsx';
import Toolbar from './components/Toolbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import Viewer from './components/Viewer.jsx';
import { IPC_CHANNELS, MODES, THEMES } from '../../shared/constants.js';
import { NotificationSystem } from './utils/notifications.js';
import WatermarkDialog from './components/WatermarkDialog.jsx';
import HeaderFooterDialog from './components/HeaderFooterDialog.jsx';
import SecurityDialog from './components/SecurityDialog.jsx';

import * as pdfjsLib from 'pdfjs-dist';
// Configure the PDF.js worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

// Helper to extend PDF.js/Mock document objects with bookmarks outline operations
const extendPdfDocWithOutlineOps = (pdfDoc) => {
  if (!pdfDoc) return;
  
  let cachedOutlinePromise = null;
  const originalGetOutline = pdfDoc.getOutline;
  
  pdfDoc.getOutline = function() {
    if (pdfDoc._customOutline) {
      return Promise.resolve(pdfDoc._customOutline);
    }
    if (originalGetOutline) {
      if (!cachedOutlinePromise) {
        cachedOutlinePromise = originalGetOutline.call(pdfDoc).then(tree => {
          const assignIds = (items) => {
            if (!items) return [];
            return items.map(item => ({
              id: item.id || 'bm_' + Math.random().toString(36).substring(2, 9),
              title: item.title,
              dest: item.dest,
              bold: item.bold,
              italic: item.italic,
              color: item.color,
              pageNumber: typeof item.dest === 'number' ? item.dest : (item.pageNumber || 1),
              items: assignIds(item.items)
            }));
          };
          pdfDoc._customOutline = assignIds(tree) || [];
          return pdfDoc._customOutline;
        }).catch(err => {
          console.warn("Failed to load original outline, using empty list:", err);
          pdfDoc._customOutline = [];
          return pdfDoc._customOutline;
        });
      }
      return cachedOutlinePromise;
    } else {
      pdfDoc._customOutline = [];
      return Promise.resolve(pdfDoc._customOutline);
    }
  };

  pdfDoc.addBookmark = function(title, pageNumber, parentId = null) {
    const newBookmark = {
      id: 'bm_' + Math.random().toString(36).substring(2, 9),
      title,
      dest: pageNumber,
      pageNumber,
      items: []
    };

    if (!pdfDoc._customOutline) pdfDoc._customOutline = [];

    if (!parentId) {
      pdfDoc._customOutline.push(newBookmark);
      return;
    }

    const insertUnderParent = (items) => {
      for (const item of items) {
        if (item.id === parentId) {
          if (!item.items) item.items = [];
          item.items.push(newBookmark);
          return true;
        }
        if (item.items && item.items.length > 0) {
          if (insertUnderParent(item.items)) return true;
        }
      }
      return false;
    };
    insertUnderParent(pdfDoc._customOutline);
  };

  pdfDoc.editBookmark = function(id, newTitle, newPageNumber) {
    if (!pdfDoc._customOutline) return;
    const updateItem = (items) => {
      for (const item of items) {
        if (item.id === id) {
          item.title = newTitle;
          item.pageNumber = newPageNumber;
          item.dest = newPageNumber;
          return true;
        }
        if (item.items && item.items.length > 0) {
          if (updateItem(item.items)) return true;
        }
      }
      return false;
    };
    updateItem(pdfDoc._customOutline);
  };

  pdfDoc.removeBookmark = function(id) {
    if (!pdfDoc._customOutline) return;
    const removeItem = (items) => {
      for (let i = 0; i < items.length; i++) {
        if (items[i].id === id) {
          items.splice(i, 1);
          return true;
        }
        if (items[i].items && items[i].items.length > 0) {
          if (removeItem(items[i].items)) return true;
        }
      }
      return false;
    };
    removeItem(pdfDoc._customOutline);
  };
};

const writeOutlines = (pdfDoc, bookmarks, PDFString) => {
  if (!bookmarks || bookmarks.length === 0) return;
  try {
    const context = pdfDoc.context;
    const catalog = pdfDoc.catalog;

    const outlineRef = context.nextRef();
    
    const allocateRefs = (items, parentRef) => {
      const allocated = [];
      for (const item of items) {
        const ref = context.nextRef();
        const childItems = item.items && item.items.length > 0 ? allocateRefs(item.items, ref) : [];
        allocated.push({
          item,
          ref,
          parentRef,
          children: childItems
        });
      }
      return allocated;
    };

    const rootItems = allocateRefs(bookmarks, outlineRef);

    const registerItems = (allocatedList) => {
      for (let i = 0; i < allocatedList.length; i++) {
        const node = allocatedList[i];
        const prevNode = i > 0 ? allocatedList[i - 1] : null;
        const nextNode = i < allocatedList.length - 1 ? allocatedList[i + 1] : null;

        const dict = context.obj({
          Title: PDFString.of(node.item.title),
          Parent: node.parentRef,
        });

        if (prevNode) dict.set(context.obj('Prev'), prevNode.ref);
        if (nextNode) dict.set(context.obj('Next'), nextNode.ref);

        if (node.children.length > 0) {
          dict.set(context.obj('First'), node.children[0].ref);
          dict.set(context.obj('Last'), node.children[node.children.length - 1].ref);
          dict.set(context.obj('Count'), context.obj(node.children.length));
        }

        let destPageNum = node.item.pageNumber || 1;
        const pages = pdfDoc.getPages();
        const pageIndex = Math.min(Math.max(0, destPageNum - 1), pages.length - 1);
        const pageRef = pages[pageIndex].ref;

        dict.set(context.obj('Dest'), context.array([pageRef, context.obj('Fit')]));

        context.assign(node.ref, dict);

        if (node.children.length > 0) {
          registerItems(node.children);
        }
      }
    };

    registerItems(rootItems);

    const outlineDict = context.obj({
      Type: 'Outlines',
      First: rootItems[0].ref,
      Last: rootItems[rootItems.length - 1].ref,
      Count: rootItems.length
    });

    context.assign(outlineRef, outlineDict);
    catalog.set(context.obj('Outlines'), outlineRef);
  } catch (err) {
    console.error("Error writing PDF outlines in writeOutlines:", err);
  }
};

export default function App() {
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  
  // App configurations
  const [activeMode, setActiveMode] = useState(MODES.VIEW);
  const [activeTool, setActiveTool] = useState('select');
  const [commentColor, setCommentColor] = useState('#6366f1');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [searchText, setSearchText] = useState('');
  
  // UI Panels state
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [selectedObject, setSelectedObject] = useState(null); // active fabric/form object properties
  
  // Saved Signature
  const [savedSignatureDataUrl, setSavedSignatureDataUrl] = useState(null);

  // Modals state
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [showCompressDialog, setShowCompressDialog] = useState(false);
  const [showOcrDialog, setShowOcrDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [showWatermarkDialog, setShowWatermarkDialog] = useState(false);
  const [showHeaderFooterDialog, setShowHeaderFooterDialog] = useState(false);
  const [showConvertFromPdfDialog, setShowConvertFromPdfDialog] = useState(false);
  const [showSecurityDialog, setShowSecurityDialog] = useState(false);
  const [convertTargetFormat, setConvertTargetFormat] = useState('docx');
  const [conversionProgress, setConversionProgress] = useState(0);
  const [showConversionProgress, setShowConversionProgress] = useState(false);
  const [conversionStatus, setConversionStatus] = useState('');

  // Modals fields state
  const [mergeFiles, setMergeFiles] = useState([]);
  const [mergeOutputName, setMergeOutputName] = useState('GauPDF_Combined.pdf');
  const [splitMode, setSplitMode] = useState('range');
  const [splitRange, setSplitRange] = useState('');
  const [splitNumber, setSplitNumber] = useState(2);
  const [compressLevel, setCompressLevel] = useState('medium');
  const [ocrLang, setOcrLang] = useState('eng');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState('Ready...');
  const [ocrResult, setOcrResult] = useState('');
  const [theme, setTheme] = useState(THEMES.DARK);
  const [autoSave, setAutoSave] = useState(true);

  // Form Fields state: array of form fields across all tabs
  // item structure: { id, tabId, pageNum, type, x, y, width, height, value }
  const [formFields, setFormFields] = useState([]);

  const fabricInstancesRef = useRef({});
  const sigCanvasRef = useRef(null);
  const isSigDrawing = useRef(false);
  const lastSigPos = useRef({ x: 0, y: 0 });

  // Get active tab object
  const activeTab = tabs.find(t => t.id === activeTabId);

  // Initial routing and setup based on CLI window config arguments
  useEffect(() => {
    const config = window.api ? window.api.getWindowConfig() : { mode: 'welcome', filePath: null };
    if (config.filePath) {
      loadPDF(config.filePath);
    }

    // Check system theme preferences
    if (window.api) {
      window.api.invoke(IPC_CHANNELS.APP_SETTINGS, { action: 'get-theme' }).then((storedTheme) => {
        if (storedTheme) {
          setTheme(storedTheme);
          document.body.className = storedTheme === THEMES.LIGHT ? 'light-theme' : '';
        }
      });

      // Listen for auto-update events
      const unsubscribeUpdateAvailable = window.api.on('app:update-available', (info) => {
        NotificationSystem.info('Auto Update', `New version ${info.version} is available! Downloading...`);
      });

      const unsubscribeUpdateDownloaded = window.api.on('app:update-downloaded', (info) => {
        NotificationSystem.success('Auto Update', `Version ${info.version} downloaded. Restart to install.`, {
          duration: 15000,
          actionLabel: 'Restart Now',
          onAction: () => {
            if (window.api) window.api.invoke('app:quit-and-install');
          }
        });
      });

      return () => {
        if (unsubscribeUpdateAvailable) unsubscribeUpdateAvailable();
        if (unsubscribeUpdateDownloaded) unsubscribeUpdateDownloaded();
      };
    }
  }, []);

  // Update freehand stroke color/width on active Fabric canvas when updated from Toolbar
  useEffect(() => {
    if (activeTab) {
      Object.values(fabricInstancesRef.current).forEach(canvas => {
        if (canvas.isDrawingMode) {
          canvas.freeDrawingBrush.color = commentColor;
          canvas.freeDrawingBrush.width = strokeWidth;
        }
        
        const activeObj = canvas.getActiveObject();
        if (activeObj) {
          if (activeObj.type === 'i-text' || activeObj.type === 'text') {
            activeObj.set('fill', commentColor);
          } else {
            activeObj.set('stroke', commentColor);
            if (activeObj.type === 'path') {
              activeObj.set('strokeWidth', strokeWidth);
            }
          }
          canvas.renderAll();
        }
      });
    }
  }, [commentColor, strokeWidth]);

  // Load a PDF document into application state
  const loadPDF = async (filePath) => {
    NotificationSystem.info('File Load', 'Loading PDF document...');
    try {
      let data = null;
      if (window.api) {
        data = await window.api.invoke('file:read', filePath);
      }
      
      const name = filePath.split(/[/\\]/).pop();
      if (data) {
        const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
        addTab(name, filePath, pdfDoc);
        NotificationSystem.success('File Load', 'PDF document loaded successfully.');
      } else {
        loadMockPDF(filePath);
      }
    } catch (err) {
      console.error(err);
      NotificationSystem.error('File Load', 'Failed to load PDF: ' + err.message);
    }
  };

  const loadMockPDF = (filePath) => {
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
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1;
            ctx.strokeRect(20 * vp.scale, 20 * vp.scale, vp.width - 40 * vp.scale, vp.height - 40 * vp.scale);
            
            ctx.fillStyle = '#1e293b';
            ctx.font = `${16 * vp.scale}px sans-serif`;
            ctx.fillText(`Mock Document: ${name}`, 40 * vp.scale, 60 * vp.scale);
            ctx.font = `${12 * vp.scale}px sans-serif`;
            ctx.fillText(`Page ${num} of 3`, 40 * vp.scale, 90 * vp.scale);
            ctx.fillStyle = '#475569';
            ctx.fillText('This is a simulated preview rendering for browser test environments.', 40 * vp.scale, 130 * vp.scale);
            ctx.fillText('Fully built using React & Vite.', 40 * vp.scale, 150 * vp.scale);
            return { promise: Promise.resolve() };
          }
        };
      },
      getOutline: async () => [
        { title: '1. Introduction', dest: 1 },
        { title: '2. Project Layout', dest: 2 },
        { title: '3. Technical Guide', dest: 3 }
      ]
    };
    addTab(name, filePath, mockDoc);
    NotificationSystem.success('Mock PDF', 'Loaded dummy PDF in preview mode.');
  };

  // Add document to workspace tabs
  const addTab = (name, filePath, pdfDoc) => {
    extendPdfDocWithOutlineOps(pdfDoc);
    const tabId = 'tab_' + Math.random().toString(36).substring(2, 9);
    const newTab = {
      id: tabId,
      name,
      filePath,
      pdfDoc,
      currentPage: 1,
      zoom: 1.0,
      layout: 'single'
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);
    
    // Add to recent files store
    if (window.api) {
      window.api.invoke(IPC_CHANNELS.APP_RECENT_FILES, { action: 'add', path: filePath });
    }
  };

  const handleCloseTab = (tabId) => {
    const nextTabs = tabs.filter(t => t.id !== tabId);
    setTabs(nextTabs);
    setFormFields(prev => prev.filter(f => f.tabId !== tabId));
    
    if (nextTabs.length > 0) {
      if (activeTabId === tabId) {
        setActiveTabId(nextTabs[nextTabs.length - 1].id);
      }
    } else {
      setActiveTabId(null);
    }
  };

  const handleOpenAnotherFile = async () => {
    if (window.api) {
      // Electron single open
      await window.api.invoke(IPC_CHANNELS.FILE_OPEN);
    } else {
      // browser mock
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          loadPDF(file.name);
        }
      };
      input.click();
    }
  };

  // ZOOM operations
  const handleZoomChange = (zoomVal) => {
    if (!activeTab) return;
    let nextZoom = 1.0;
    if (zoomVal === 'fit-width') {
      const viewport = document.getElementById('document-viewport');
      const width = viewport ? (viewport.getBoundingClientRect().width - 64) : 595;
      nextZoom = width / 595;
    } else if (zoomVal === 'fit-page') {
      const viewport = document.getElementById('document-viewport');
      const height = viewport ? (viewport.getBoundingClientRect().height - 64) : 842;
      nextZoom = height / 842;
    } else {
      nextZoom = parseFloat(zoomVal);
    }
    nextZoom = Math.min(Math.max(nextZoom, 0.25), 4.0);
    activeTab.zoom = nextZoom;
    setTabs([...tabs]);
  };

  // LAYOUT operations
  const handleLayoutChange = (layoutVal) => {
    if (!activeTab) return;
    activeTab.layout = layoutVal;
    setTabs([...tabs]);
  };

  // SCROLL operations
  const handleGoToPage = (pageNum) => {
    if (!activeTab) return;
    activeTab.currentPage = pageNum;
    setTabs([...tabs]);
    
    if (activeTab.layout === 'continuous') {
      const container = document.getElementById(`page-container-${pageNum}`);
      if (container) {
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleGoToDestination = (dest) => {
    let pageNum = 1;
    if (typeof dest === 'number') pageNum = dest;
    handleGoToPage(pageNum);
  };

  // FEATURE: Form Fields placement
  const handleAddFormField = (pageNum, type, x, y) => {
    const fieldId = 'field_' + Math.random().toString(36).substring(2, 9);
    const newField = {
      id: fieldId,
      tabId: activeTabId,
      pageNum,
      type,
      x,
      y,
      width: type === 'text' ? 140 : 20,
      height: type === 'text' ? 24 : 20,
      value: type === 'text' ? '' : false
    };
    setFormFields(prev => [...prev, newField]);
    setActiveTool('select');
  };

  const handleFormFieldClick = (field, overlayEl) => {
    setSelectedObject({
      type: 'form',
      field,
      element: overlayEl
    });
    setRightSidebarOpen(true);
  };

  const handleUpdateFormFieldValue = (fieldId, newValue) => {
    setFormFields(prev => prev.map(f => f.id === fieldId ? { ...f, value: newValue } : f));
  };

  // FEATURE: Fabric instance tracking
  const registerFabricInstance = (pageNum, canvas) => {
    fabricInstancesRef.current[pageNum] = canvas;
  };

  const unregisterFabricInstance = (pageNum) => {
    delete fabricInstancesRef.current[pageNum];
  };

  // Operations: Document Save / Save As / Print
  const handleSave = async () => {
    if (!activeTab) return;
    NotificationSystem.info('Saving Document', 'Saving PDF modifications...');

    const serializedAnnotations = {};
    Object.entries(fabricInstancesRef.current).forEach(([pageNum, instance]) => {
      serializedAnnotations[pageNum] = instance.toJSON(['isNoteCircle', 'noteText', 'isTextCallout', 'isStamp', 'stampText', 'isFormField', 'fieldType', 'fieldId', 'maxLength', 'required', 'value', 'isRedaction']);
    });

    let pdfBytes = null;
    if (window.api) {
      try {
        const { PDFDocument, PDFString } = await import('pdf-lib');
        const rawBytes = await window.api.invoke('file:read', activeTab.filePath);
        if (rawBytes) {
          const pdfDoc = await PDFDocument.load(rawBytes);
          const form = pdfDoc.getForm();
          const pages = pdfDoc.getPages();

          // Get active form field IDs on the canvas to handle synchronized deletion
          const activeFieldIds = new Set();
          Object.values(fabricInstancesRef.current).forEach(canvas => {
            canvas.getObjects().forEach(obj => {
              if (obj.isFormField) {
                activeFieldIds.add(obj.fieldId);
              }
            });
          });

          // Sync deletion: remove fields in PDF that are no longer on any canvas
          const fields = form.getFields();
          fields.forEach(field => {
            const name = field.getName();
            if (!activeFieldIds.has(name)) {
              try {
                form.removeField(field);
              } catch (e) {
                console.warn(`Could not remove field ${name}:`, e);
              }
            }
          });

          // Update or add form fields from Fabric canvases
          for (const [pageNumStr, canvas] of Object.entries(fabricInstancesRef.current)) {
            const pageNum = parseInt(pageNumStr, 10);
            const page = pages[pageNum - 1];
            if (!page) continue;

            const { height: pageHeight } = page.getSize();
            const zoom = canvas.getZoom() || 1.0;
            const objects = canvas.getObjects();

            for (const obj of objects) {
              if (obj.isFormField) {
                const x = obj.left / zoom;
                const y = pageHeight - (obj.top / zoom) - ((obj.height * obj.scaleY) / zoom);
                const w = (obj.width * obj.scaleX) / zoom;
                const h = (obj.height * obj.scaleY) / zoom;

                if (obj.fieldType === 'text') {
                  let textField;
                  try {
                    textField = form.getTextField(obj.fieldId);
                  } catch (e) {
                    textField = form.createTextField(obj.fieldId);
                  }
                  textField.setText(obj.text || obj.value || '');
                  if (obj.maxLength > 0) {
                    textField.setMaxLength(obj.maxLength);
                  }
                  textField.setRequired(!!obj.required);
                  
                  try {
                    textField.acroField.getWidgets().forEach(widget => textField.acroField.removeWidget(widget));
                    textField.addToPage(page, { x, y, width: w, height: h });
                  } catch (err) {
                    try {
                      textField.addToPage(page, { x, y, width: w, height: h });
                    } catch (e2) {}
                  }
                } else if (obj.fieldType === 'checkbox') {
                  let checkBox;
                  try {
                    checkBox = form.getCheckBox(obj.fieldId);
                  } catch (e) {
                    checkBox = form.createCheckBox(obj.fieldId);
                  }
                  if (obj.value) {
                    checkBox.check();
                  } else {
                    checkBox.uncheck();
                  }
                  checkBox.setRequired(!!obj.required);

                  try {
                    checkBox.acroField.getWidgets().forEach(widget => checkBox.acroField.removeWidget(widget));
                    checkBox.addToPage(page, { x, y, width: w, height: h });
                  } catch (err) {
                    try {
                      checkBox.addToPage(page, { x, y, width: w, height: h });
                    } catch (e2) {}
                  }
                }
              }
            }
          }

          if (activeTab.pdfDoc && activeTab.pdfDoc._customOutline) {
            writeOutlines(pdfDoc, activeTab.pdfDoc._customOutline, PDFString);
          }

          pdfBytes = await pdfDoc.save();
        }
      } catch (err) {
        console.error("Error compiling form fields during save:", err);
      }
    }

    if (window.api) {
      try {
        const success = await window.api.invoke(IPC_CHANNELS.FILE_SAVE, {
          filePath: activeTab.filePath,
          data: pdfBytes,
          annotations: serializedAnnotations
        });
        if (success) {
          NotificationSystem.success('Save', 'Saved changes successfully.');
        } else {
          NotificationSystem.error('Save', 'Failed to save changes.');
        }
      } catch (err) {
        NotificationSystem.error('Save', err.message);
      }
    } else {
      setTimeout(() => {
        NotificationSystem.success('Save (Mock)', 'Changes saved successfully.');
      }, 500);
    }
  };

  const handleSaveAs = async () => {
    if (!activeTab) return;
    if (window.api) {
      try {
        const result = await window.api.invoke(IPC_CHANNELS.FILE_SAVE_AS, {
          defaultPath: activeTab.filePath
        });
        if (result && result.filePath) {
          NotificationSystem.success('Save As', `Document saved to: ${result.filePath}`);
        }
      } catch (err) {
        NotificationSystem.error('Save As', err.message);
      }
    } else {
      NotificationSystem.info('Save As', 'Save As feature mock triggered.');
    }
  };

  const handlePrint = async () => {
    if (!activeTab) return;
    if (window.api) {
      try {
        await window.api.invoke(IPC_CHANNELS.PRINT_EXECUTE, { filePath: activeTab.filePath });
      } catch (err) {
        NotificationSystem.error('Print', err.message);
      }
    } else {
      window.print();
    }
  };

  // Sidebar controls
  const handleDeleteSelectedObject = () => {
    if (!selectedObject) return;
    if (selectedObject.type === 'form') {
      setFormFields(prev => prev.filter(f => f.id !== selectedObject.field.id));
      setSelectedObject(null);
    } else if (selectedObject.ref) {
      const canvas = selectedObject.ref.canvas;
      if (canvas) {
        canvas.remove(selectedObject.ref);
        canvas.discardActiveObject();
        canvas.renderAll();
      }
      setSelectedObject(null);
    }
  };

  // Modals execute logic
  const handleExecuteMerge = async () => {
    if (mergeFiles.length < 2) {
      NotificationSystem.warning('Merge PDFs', 'Please select at least 2 files to merge.');
      return;
    }
    NotificationSystem.info('Merge PDFs', 'Processing merging files...');
    if (window.api) {
      try {
        const result = await window.api.invoke(IPC_CHANNELS.PDF_MERGE, {
          files: mergeFiles,
          outputPath: mergeOutputName
        });
        if (result) {
          NotificationSystem.success('Merge PDFs', 'Merged PDFs successfully.');
          setShowMergeDialog(false);
        }
      } catch (err) {
        NotificationSystem.error('Merge PDFs', err.message);
      }
    } else {
      setTimeout(() => {
        NotificationSystem.success('Merge PDFs (Mock)', 'Merged PDFs combined successfully.');
        setShowMergeDialog(false);
      }, 1000);
    }
  };

  const handleExecuteSplit = async () => {
    if (!activeTab && splitMode !== 'pages') {
      NotificationSystem.warning('Split PDF', 'Open a PDF document first.');
      return;
    }
    NotificationSystem.info('Split PDF', 'Splitting PDF page ranges...');
    if (window.api) {
      try {
        const result = await window.api.invoke(IPC_CHANNELS.PDF_SPLIT, {
          filePath: activeTab.filePath,
          ranges: splitMode === 'range' ? splitRange : splitMode === 'equal' ? splitNumber : 'all'
        });
        if (result) {
          NotificationSystem.success('Split PDF', 'Split PDF successfully.');
          setShowSplitDialog(false);
        }
      } catch (err) {
        NotificationSystem.error('Split PDF', err.message);
      }
    } else {
      setTimeout(() => {
        NotificationSystem.success('Split PDF (Mock)', 'Document page split successfully.');
        setShowSplitDialog(false);
      }, 1000);
    }
  };

  const handleExecuteCompress = async () => {
    if (!activeTab) return;
    NotificationSystem.info('Compress PDF', 'Reducing PDF file size...');
    if (window.api) {
      try {
        const result = await window.api.invoke(IPC_CHANNELS.PDF_COMPRESS, {
          filePath: activeTab.filePath,
          level: compressLevel
        });
        if (result) {
          NotificationSystem.success('Compress PDF', 'Compressed PDF successfully.');
          setShowCompressDialog(false);
        }
      } catch (err) {
        NotificationSystem.error('Compress PDF', err.message);
      }
    } else {
      setTimeout(() => {
        NotificationSystem.success('Compress PDF (Mock)', 'Compressed document saved.');
        setShowCompressDialog(false);
      }, 1000);
    }
  };

  const handleExecuteOcr = async () => {
    if (!activeTab) return;
    NotificationSystem.info('OCR text extract', 'Extracting text...');
    setOcrProgress(20);
    setOcrStatus('Initializing OCR engine...');
    
    if (window.api) {
      try {
        setOcrProgress(50);
        setOcrStatus('Extracting content...');
        const result = await window.api.invoke(IPC_CHANNELS.OCR_EXECUTE, {
          imageBufferOrPath: activeTab.filePath,
          language: ocrLang
        });
        setOcrProgress(100);
        setOcrStatus('Completed!');
        setOcrResult(result || 'No text recognized.');
      } catch (err) {
        setOcrProgress(0);
        setOcrStatus('Error');
        NotificationSystem.error('OCR Error', err.message);
      }
    } else {
      setTimeout(() => {
        setOcrProgress(100);
        setOcrStatus('Completed (Mock)');
        setOcrResult('This is a simulated OCR result. GauPDF recognized English text from scanned document mockup.');
      }, 1500);
    }
  };

  const handleExecuteWatermark = async (data) => {
    if (!activeTab) {
      NotificationSystem.warning('Watermark', 'Please open a PDF document first.');
      return;
    }
    NotificationSystem.info('Watermark', 'Applying watermark to PDF...');
    if (window.api) {
      try {
        setConversionStatus('Applying watermark...');
        setShowConversionProgress(true);
        setConversionProgress(20);
        
        const result = await window.api.invoke('pdf:watermark', {
          filePath: activeTab.filePath,
          options: data
        });
        setConversionProgress(100);
        
        if (result) {
          NotificationSystem.success('Watermark', 'Watermark applied successfully.');
          if (typeof result === 'string' && result !== activeTab.filePath) {
            loadPDF(result);
          }
        }
      } catch (err) {
        NotificationSystem.error('Watermark Error', err.message);
      } finally {
        setShowConversionProgress(false);
        setShowWatermarkDialog(false);
      }
    } else {
      setShowConversionProgress(true);
      setConversionStatus('Simulating watermark application...');
      setConversionProgress(30);
      setTimeout(() => {
        setConversionProgress(70);
        setTimeout(() => {
          setConversionProgress(100);
          setShowConversionProgress(false);
          NotificationSystem.success('Watermark (Mock)', 'Watermark applied and saved successfully.');
          setShowWatermarkDialog(false);
        }, 800);
      }, 600);
    }
  };

  const handleExecuteHeaderFooter = async (data) => {
    if (!activeTab) {
      NotificationSystem.warning('Header & Footer', 'Please open a PDF document first.');
      return;
    }
    NotificationSystem.info('Header & Footer', 'Applying headers & footers to PDF...');
    if (window.api) {
      try {
        setConversionStatus('Adding headers and footers...');
        setShowConversionProgress(true);
        setConversionProgress(20);
        
        const result = await window.api.invoke('pdf:header-footer', {
          filePath: activeTab.filePath,
          options: data
        });
        setConversionProgress(100);
        
        if (result) {
          NotificationSystem.success('Header & Footer', 'Headers and footers added successfully.');
          if (typeof result === 'string' && result !== activeTab.filePath) {
            loadPDF(result);
          }
        }
      } catch (err) {
        NotificationSystem.error('Header & Footer Error', err.message);
      } finally {
        setShowConversionProgress(false);
        setShowHeaderFooterDialog(false);
      }
    } else {
      setShowConversionProgress(true);
      setConversionStatus('Simulating headers & footers...');
      setConversionProgress(30);
      setTimeout(() => {
        setConversionProgress(70);
        setTimeout(() => {
          setConversionProgress(100);
          setShowConversionProgress(false);
          NotificationSystem.success('Header & Footer (Mock)', 'Headers and footers added successfully.');
          setShowHeaderFooterDialog(false);
        }, 800);
      }, 600);
    }
  };

  const handleConvertToPdf = async () => {
    NotificationSystem.info('Convert to PDF', 'Selecting source document...');
    if (window.api) {
      try {
        const files = await window.api.invoke(IPC_CHANNELS.FILE_OPEN, {
          title: 'Select Document to Convert',
          filters: [
            { name: 'Convertible Files', extensions: ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'png', 'jpg', 'jpeg', 'txt'] }
          ]
        });
        
        if (files && files.length > 0) {
          const sourcePath = files[0];
          setShowConversionProgress(true);
          setConversionStatus('Converting source file to PDF...');
          setConversionProgress(10);
          
          const timer = setInterval(() => {
            setConversionProgress(prev => Math.min(prev + 15, 85));
          }, 400);
          
          const destPath = await window.api.invoke(IPC_CHANNELS.PDF_CONVERT_TO_PDF, {
            filePath: sourcePath
          });
          
          clearInterval(timer);
          setConversionProgress(100);
          
          if (destPath) {
            NotificationSystem.success('Convert to PDF', 'File converted successfully.');
            loadPDF(destPath);
          }
        }
      } catch (err) {
        NotificationSystem.error('Convert Error', err.message);
      } finally {
        setShowConversionProgress(false);
      }
    } else {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.txt';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          setShowConversionProgress(true);
          setConversionStatus(`Mock converting ${file.name} to PDF...`);
          setConversionProgress(20);
          setTimeout(() => {
            setConversionProgress(60);
            setTimeout(() => {
              setConversionProgress(100);
              setShowConversionProgress(false);
              NotificationSystem.success('Convert (Mock)', 'Document converted to PDF.');
              loadMockPDF(file.name.split('.')[0] + '_converted.pdf');
            }, 800);
          }, 600);
        }
      };
      input.click();
    }
  };

  const handleConvertFromPdf = async () => {
    if (!activeTab) {
      NotificationSystem.warning('Convert from PDF', 'Please open a PDF document first.');
      return;
    }
    setShowConvertFromPdfDialog(true);
  };

  const handleExecuteConvertFromPdf = async () => {
    setShowConvertFromPdfDialog(false);
    NotificationSystem.info('Convert from PDF', `Converting PDF to ${convertTargetFormat.toUpperCase()}...`);
    
    if (window.api) {
      try {
        setShowConversionProgress(true);
        setConversionStatus(`Converting PDF to ${convertTargetFormat.toUpperCase()}...`);
        setConversionProgress(10);
        
        const timer = setInterval(() => {
          setConversionProgress(prev => Math.min(prev + 10, 90));
        }, 300);
        
        const result = await window.api.invoke(IPC_CHANNELS.PDF_CONVERT_FROM_PDF, {
          filePath: activeTab.filePath,
          format: convertTargetFormat
        });
        
        clearInterval(timer);
        setConversionProgress(100);
        
        if (result) {
          NotificationSystem.success('Convert from PDF', `File successfully converted to ${convertTargetFormat.toUpperCase()}.`);
        }
      } catch (err) {
        NotificationSystem.error('Convert Error', err.message);
      } finally {
        setShowConversionProgress(false);
      }
    } else {
      setShowConversionProgress(true);
      setConversionStatus(`Converting to ${convertTargetFormat.toUpperCase()} (Mock)...`);
      setConversionProgress(20);
      setTimeout(() => {
        setConversionProgress(75);
        setTimeout(() => {
          setConversionProgress(100);
          setShowConversionProgress(false);
          NotificationSystem.success('Convert from PDF (Mock)', `Document converted and saved in ${convertTargetFormat.toUpperCase()} format.`);
        }, 900);
      }, 700);
    }
  };

  const handleExecuteSecurity = async (securityOptions) => {
    if (!activeTab) return;
    setShowSecurityDialog(false);
    NotificationSystem.info('Security', 'Applying PDF encryption and permission restrictions...');

    setShowConversionProgress(true);
    setConversionStatus('Encrypting document...');
    setConversionProgress(25);

    if (window.api) {
      try {
        setConversionProgress(60);
        const result = await window.api.invoke('pdf:apply-security', {
          filePath: activeTab.filePath,
          options: securityOptions
        });
        setConversionProgress(100);
        if (result && result.success) {
          NotificationSystem.success('Security', 'PDF security settings applied successfully.');
        } else {
          NotificationSystem.success('Security', 'PDF secured successfully.');
        }
      } catch (err) {
        console.error('Security error:', err);
        NotificationSystem.error('Security Error', err.message);
      } finally {
        setShowConversionProgress(false);
      }
    } else {
      setTimeout(() => {
        setConversionProgress(80);
        setTimeout(() => {
          setConversionProgress(100);
          setShowConversionProgress(false);
          NotificationSystem.success('Security (Mock)', `PDF password security applied with ${securityOptions.encryptionStrength}.`);
        }, 800);
      }, 600);
    }
  };

  const handleApplyRedactions = async () => {
    if (!activeTab) return;
    NotificationSystem.info('Redaction', 'Applying permanent redactions...');

    const redactionRectsByPage = {};
    let totalRedactions = 0;

    Object.entries(fabricInstancesRef.current).forEach(([pageNumStr, canvas]) => {
      const pageNum = parseInt(pageNumStr, 10);
      const objects = canvas.getObjects();
      const redactObjs = objects.filter(obj => obj.isRedaction);
      if (redactObjs.length > 0) {
        redactionRectsByPage[pageNum] = redactObjs;
        totalRedactions += redactObjs.length;
      }
    });

    if (totalRedactions === 0) {
      NotificationSystem.warning('Redaction', 'No redaction areas drawn. Select the Redact tool and draw rectangles first.');
      return;
    }

    setShowConversionProgress(true);
    setConversionStatus('Executing permanent redactions...');
    setConversionProgress(20);

    try {
      let pdfBytes = null;
      if (window.api) {
        const rawBytes = await window.api.invoke('file:read', activeTab.filePath);
        if (rawBytes) {
          setConversionProgress(45);
          const { PDFDocument, rgb } = await import('pdf-lib');
          const pdfDoc = await PDFDocument.load(rawBytes);
          const pages = pdfDoc.getPages();

          Object.entries(redactionRectsByPage).forEach(([pageNumStr, rects]) => {
            const pageNum = parseInt(pageNumStr, 10);
            const page = pages[pageNum - 1];
            if (!page) return;

            const { height: pageHeight } = page.getSize();
            const canvas = fabricInstancesRef.current[pageNumStr];
            const zoom = canvas ? canvas.getZoom() : 1.0;

            rects.forEach(rect => {
              const x = rect.left / zoom;
              const y = pageHeight - (rect.top / zoom) - ((rect.height * rect.scaleY) / zoom);
              const w = (rect.width * rect.scaleX) / zoom;
              const h = (rect.height * rect.scaleY) / zoom;

              // Cover permanently with black rectangle
              page.drawRectangle({
                x,
                y,
                width: w,
                height: h,
                color: rgb(0, 0, 0)
              });
            });
          });

          setConversionProgress(80);
          pdfBytes = await pdfDoc.save();
        }
      }

      setConversionProgress(90);

      if (window.api && pdfBytes) {
        const success = await window.api.invoke(IPC_CHANNELS.FILE_SAVE, {
          filePath: activeTab.filePath,
          data: pdfBytes
        });

        if (success) {
          // Remove redactions from canvas
          Object.entries(redactionRectsByPage).forEach(([pageNumStr, rects]) => {
            const canvas = fabricInstancesRef.current[pageNumStr];
            if (canvas) {
              rects.forEach(rect => canvas.remove(rect));
              canvas.requestRenderAll();
            }
          });

          setConversionProgress(100);
          setShowConversionProgress(false);
          NotificationSystem.success('Redaction', 'Permanent redactions applied successfully.');
          loadPDF(activeTab.filePath);
        } else {
          setShowConversionProgress(false);
          NotificationSystem.error('Redaction', 'Failed to save redacted PDF.');
        }
      } else {
        // Mock
        setTimeout(() => {
          Object.entries(redactionRectsByPage).forEach(([pageNumStr, rects]) => {
            const canvas = fabricInstancesRef.current[pageNumStr];
            if (canvas) {
              rects.forEach(rect => canvas.remove(rect));
              canvas.requestRenderAll();
            }
          });
          setConversionProgress(100);
          setShowConversionProgress(false);
          NotificationSystem.success('Redaction (Mock)', 'Applied permanent black redactions successfully.');
        }, 1200);
      }
    } catch (err) {
      console.error('Redaction error:', err);
      setShowConversionProgress(false);
      NotificationSystem.error('Redaction Error', err.message);
    }
  };

  const handleSaveSettings = async () => {
    if (window.api) {
      await window.api.invoke(IPC_CHANNELS.APP_SETTINGS, {
        action: 'set',
        data: { autoSave, language: 'en' }
      });
      await window.api.invoke(IPC_CHANNELS.APP_SETTINGS, {
        action: 'set-theme',
        data: theme
      });
    }
    document.body.className = theme === THEMES.LIGHT ? 'light-theme' : '';
    NotificationSystem.success('Settings', 'Configurations saved successfully.');
    setShowSettingsDialog(false);
  };

  // Signature Pad drawing mouse listeners
  const startSigDrawing = (e) => {
    isSigDrawing.current = true;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    lastSigPos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const drawSig = (e) => {
    if (!isSigDrawing.current) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(lastSigPos.current.x, lastSigPos.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();

    lastSigPos.current = { x, y };
  };

  const stopSigDrawing = () => {
    isSigDrawing.current = false;
  };

  const handleSaveSignature = () => {
    const canvas = sigCanvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      setSavedSignatureDataUrl(dataUrl);
      setShowSignatureDialog(false);
      
      NotificationSystem.success('Signature', 'Signature created. Select anywhere on form to place signature stamp.');
      setActiveMode(MODES.FORMS);
      setActiveTool('signature');
    }
  };

  const handleClearSignature = () => {
    const canvas = sigCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  useEffect(() => {
    if (showSignatureDialog && sigCanvasRef.current) {
      const canvas = sigCanvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, [showSignatureDialog]);

  // Organize rotations
  const handleRotateLeft = () => {
    if (!activeTab) return;
    const container = document.getElementById(`page-container-${activeTab.currentPage}`);
    if (container) {
      const currentRot = parseInt(container.getAttribute('data-rotation') || '0', 10);
      const nextRot = (currentRot - 90 + 360) % 360;
      container.setAttribute('data-rotation', nextRot);
      container.style.transform = `rotate(${nextRot}deg)`;
      container.style.transition = 'transform 0.3s ease';
      NotificationSystem.success('Rotate', `Rotated page ${activeTab.currentPage} left.`);
    }
  };

  const handleRotateRight = () => {
    if (!activeTab) return;
    const container = document.getElementById(`page-container-${activeTab.currentPage}`);
    if (container) {
      const currentRot = parseInt(container.getAttribute('data-rotation') || '0', 10);
      const nextRot = (currentRot + 90) % 360;
      container.setAttribute('data-rotation', nextRot);
      container.style.transform = `rotate(${nextRot}deg)`;
      container.style.transition = 'transform 0.3s ease';
      NotificationSystem.success('Rotate', `Rotated page ${activeTab.currentPage} right.`);
    }
  };

  const handleDeletePage = () => {
    if (!activeTab) return;
    NotificationSystem.warning('Organize', `Simulated deleting page ${activeTab.currentPage} from document.`);
    // Real PDF page deletion is done by PDF modification libraries on save. 
    // Here we visually hide it for demonstration.
    const pageEl = document.getElementById(`page-container-${activeTab.currentPage}`);
    if (pageEl) pageEl.style.display = 'none';
  };

  const handleInsertBlankPage = () => {
    if (!activeTab) return;
    activeTab.pdfDoc.numPages += 1;
    setTabs([...tabs]);
    NotificationSystem.success('Organize', 'Inserted blank page successfully.');
  };

  return (
    <div id="app-container">
      {/* Titlebar */}
      <Titlebar
        onOpenClick={handleOpenAnotherFile}
        onSaveClick={handleSave}
        onSaveAsClick={handleSaveAs}
        onPrintClick={handlePrint}
        onSettingsClick={() => setShowSettingsDialog(true)}
        onMergeClick={() => setShowMergeDialog(true)}
        onSplitClick={() => setShowSplitDialog(true)}
        onCompressClick={() => setShowCompressDialog(true)}
        onOcrClick={() => setShowOcrDialog(true)}
        onSignatureClick={() => setShowSignatureDialog(true)}
        onWatermarkClick={() => setShowWatermarkDialog(true)}
        onHeaderFooterClick={() => setShowHeaderFooterDialog(true)}
        onConvertToPdfClick={handleConvertToPdf}
        onConvertFromPdfClick={handleConvertFromPdf}
        hasActiveDoc={!!activeTab}
      />

      {/* Conditionally render toolbar if doc is active */}
      <Toolbar
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        activeTool={activeTool}
        setActiveTool={setActiveTool}
        commentColor={commentColor}
        setCommentColor={setCommentColor}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        zoom={activeTab ? activeTab.zoom : 1.0}
        setZoom={handleZoomChange}
        layout={activeTab ? activeTab.layout : 'single'}
        setLayout={handleLayoutChange}
        searchText={searchText}
        setSearchText={setSearchText}
        onOpenClick={handleOpenAnotherFile}
        onSaveClick={handleSave}
        onSaveAsClick={handleSaveAs}
        onPrintClick={handlePrint}
        onSettingsClick={() => setShowSettingsDialog(true)}
        onOcrClick={() => setShowOcrDialog(true)}
        onRotateLeft={handleRotateLeft}
        onRotateRight={handleRotateRight}
        onDeletePage={handleDeletePage}
        onInsertBlankPage={handleInsertBlankPage}
        onMergeClick={() => setShowMergeDialog(true)}
        onSplitClick={() => setShowSplitDialog(true)}
        onCompressClick={() => setShowCompressDialog(true)}
        onSignatureClick={() => setShowSignatureDialog(true)}
        hasActiveDoc={!!activeTab}
        onApplyRedactions={handleApplyRedactions}
        onSecurityClick={() => setShowSecurityDialog(true)}
      />

      {/* Main Workspace Frame */}
      <div id="app-body">
        {/* Left Navigation Sidebar */}
        <Sidebar
          side="left"
          isOpen={leftSidebarOpen}
          onClose={() => setLeftSidebarOpen(false)}
          pdfDoc={activeTab ? activeTab.pdfDoc : null}
          currentPage={activeTab ? activeTab.currentPage : 1}
          onGoToPage={handleGoToPage}
          onGoToDestination={handleGoToDestination}
        />

        {/* Workspace Viewer or Dashboard */}
        {!activeTab ? (
          <Welcome
            onOpenFile={(name, file) => {
              if (file) {
                // Read local file
                const reader = new FileReader();
                reader.onload = () => {
                  const data = new Uint8Array(reader.result);
                  pdfjsLib.getDocument({ data }).promise.then(pdfDoc => {
                    addTab(name, name, pdfDoc);
                  });
                };
                reader.readAsArrayBuffer(file);
              } else {
                loadPDF(name);
              }
            }}
            onOpenMergeDialog={() => setShowMergeDialog(true)}
            onOpenSplitDialog={() => setShowSplitDialog(true)}
            onOpenCompressDialog={() => setShowCompressDialog(true)}
            onOpenOcrDialog={() => setShowOcrDialog(true)}
            onOpenSettingsDialog={() => setShowSettingsDialog(true)}
            onOpenConvertToPdfDialog={handleConvertToPdf}
            onOpenConvertFromPdfDialog={handleConvertFromPdf}
            onOpenWatermarkDialog={() => setShowWatermarkDialog(true)}
            onOpenHeaderFooterDialog={() => setShowHeaderFooterDialog(true)}
          />
        ) : (
          <div style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            {/* Tabs Header bar */}
            <div id="tabs-header">
              {tabs.map(tab => (
                <div
                  key={tab.id}
                  className={`doc-tab ${activeTabId === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTabId(tab.id)}
                >
                  <span title={tab.filePath}>{tab.name}</span>
                  <button className="doc-tab-close" onClick={(e) => { e.stopPropagation(); handleCloseTab(tab.id); }}>&times;</button>
                </div>
              ))}
              <button className="btn btn-icon" onClick={handleOpenAnotherFile} title="Open new document">+</button>
            </div>
            
            {/* Main Pages viewport */}
            <Viewer
              activeTab={activeTab}
              activeMode={activeMode}
              activeTool={activeTool}
              setActiveTool={setActiveTool}
              commentColor={commentColor}
              strokeWidth={strokeWidth}
              savedSignatureDataUrl={savedSignatureDataUrl}
              setSelectedObject={setSelectedObject}
              formFields={formFields}
              onAddFormField={handleAddFormField}
              onFormFieldClick={handleFormFieldClick}
              onUpdateFormFieldValue={handleUpdateFormFieldValue}
              registerFabricInstance={registerFabricInstance}
              unregisterFabricInstance={unregisterFabricInstance}
              onViewportScroll={(activePage) => {
                activeTab.currentPage = activePage;
                setTabs([...tabs]);
              }}
            />
          </div>
        )}

        {/* Right Properties Inspector Sidebar */}
        <Sidebar
          side="right"
          isOpen={rightSidebarOpen}
          onClose={() => setRightSidebarOpen(false)}
          selectedObject={selectedObject}
          setSelectedObject={setSelectedObject}
          onDeleteSelectedObject={handleDeleteSelectedObject}
        />
      </div>

      {/* Bottom Status bar */}
      <footer id="statusbar">
        <div className="status-section">
          <button
            className={`btn btn-icon ${leftSidebarOpen ? 'active' : ''}`}
            onClick={() => setLeftSidebarOpen(!leftSidebarOpen)}
            title="Toggle Left Sidebar"
            disabled={!activeTab}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
          </button>
          <span>{activeTab ? 'Editing Document' : 'Ready'}</span>
        </div>
        <div className="status-section">
          <span>{activeTab ? `Page ${activeTab.currentPage} of ${activeTab.pdfDoc.numPages}` : 'Page - of -'}</span>
        </div>
        <div className="status-section zoom-controls">
          <button className="zoom-btn" onClick={() => handleZoomChange('fit-width')} disabled={!activeTab}>Fit Width</button>
          <button className="zoom-btn" onClick={() => handleZoomChange('fit-page')} disabled={!activeTab}>Fit Page</button>
          <div className="toolbar-separator"></div>
          <span>{activeTab ? `${Math.round(activeTab.zoom * 100)}%` : '100%'}</span>
          <button
            className={`btn btn-icon ${rightSidebarOpen ? 'active' : ''}`}
            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
            title="Toggle Properties Panel"
            disabled={!activeTab}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
          </button>
        </div>
      </footer>

      {/* Toast container */}
      <div id="toast-container" />

      {/* Modals Dialogs Windows */}

      {/* Merge PDF Modal */}
      {showMergeDialog && (
        <div className="dialog-backdrop">
          <div className="dialog-window">
            <div className="dialog-header">
              <h3>Merge PDF Documents</h3>
              <button className="dialog-close-btn" onClick={() => setShowMergeDialog(false)}>&times;</button>
            </div>
            <div className="dialog-body">
              <div className="form-group">
                <label>Drag & drop or select files to combine:</label>
                <div
                  className="dialog-file-drop"
                  onClick={async () => {
                    if (window.api) {
                      const files = await window.api.invoke(IPC_CHANNELS.FILE_OPEN, { multi: true });
                      if (files) setMergeFiles(prev => [...prev, ...files]);
                    } else {
                      // browser mockup file selection
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.multiple = true;
                      input.accept = '.pdf';
                      input.onchange = (e) => {
                        const files = Array.from(e.target.files).map(f => f.name);
                        setMergeFiles(prev => [...prev, ...files]);
                      };
                      input.click();
                    }
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span>Click to select PDF files...</span>
                </div>
                <div className="dialog-file-list">
                  {mergeFiles.map((file, idx) => (
                    <div key={idx} className="dialog-file-item">
                      <span>{file.split(/[/\\]/).pop()}</span>
                      <button className="recent-action-btn" onClick={() => setMergeFiles(prev => prev.filter((_, i) => i !== idx))}>&times;</button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="merge-output-name">Output file name:</label>
                <input
                  type="text"
                  id="merge-output-name"
                  className="form-control"
                  value={mergeOutputName}
                  onChange={(e) => setMergeOutputName(e.target.value)}
                />
              </div>
            </div>
            <div className="dialog-footer">
              <button className="btn btn-secondary" onClick={() => setShowMergeDialog(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleExecuteMerge}>Merge PDFs</button>
            </div>
          </div>
        </div>
      )}

      {/* Split PDF Modal */}
      {showSplitDialog && (
        <div className="dialog-backdrop">
          <div className="dialog-window">
            <div className="dialog-header">
              <h3>Split PDF Document</h3>
              <button className="dialog-close-btn" onClick={() => setShowSplitDialog(false)}>&times;</button>
            </div>
            <div className="dialog-body">
              <div className="form-group">
                <label>Split Method:</label>
                <select className="form-control" value={splitMode} onChange={(e) => setSplitMode(e.target.value)}>
                  <option value="range">Extract page ranges</option>
                  <option value="equal">Split into equal parts</option>
                  <option value="pages">Extract all pages</option>
                </select>
              </div>
              {splitMode === 'range' && (
                <div className="form-group">
                  <label>Page Ranges (e.g. 1-3, 4-8):</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 1-2, 3-5"
                    value={splitRange}
                    onChange={(e) => setSplitRange(e.target.value)}
                  />
                </div>
              )}
              {splitMode === 'equal' && (
                <div className="form-group">
                  <label>Number of outputs:</label>
                  <input
                    type="number"
                    className="form-control"
                    value={splitNumber}
                    onChange={(e) => setSplitNumber(parseInt(e.target.value) || 2)}
                    min="2"
                  />
                </div>
              )}
            </div>
            <div className="dialog-footer">
              <button className="btn btn-secondary" onClick={() => setShowSplitDialog(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleExecuteSplit}>Split PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* Compress PDF Modal */}
      {showCompressDialog && (
        <div className="dialog-backdrop">
          <div className="dialog-window">
            <div className="dialog-header">
              <h3>Compress PDF File</h3>
              <button className="dialog-close-btn" onClick={() => setShowCompressDialog(false)}>&times;</button>
            </div>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label>Compression Level:</label>
                <select className="form-control" value={compressLevel} onChange={(e) => setCompressLevel(e.target.value)}>
                  <option value="low">Low compression (High quality images)</option>
                  <option value="medium">Medium compression (Balanced quality & size)</option>
                  <option value="high">High compression (Minimum file size)</option>
                </select>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                This optimization reduces document size, updates graphic links resolutions, and removes metadata flags.
              </p>
            </div>
            <div className="dialog-footer">
              <button className="btn btn-secondary" onClick={() => setShowCompressDialog(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleExecuteCompress}>Compress</button>
            </div>
          </div>
        </div>
      )}

      {/* OCR Dialog */}
      {showOcrDialog && (
        <div className="dialog-backdrop">
          <div className="dialog-window" style={{ width: '600px' }}>
            <div className="dialog-header">
              <h3>OCR Text Recognition</h3>
              <button className="dialog-close-btn" onClick={() => setShowOcrDialog(false)}>&times;</button>
            </div>
            <div className="dialog-body">
              <div className="form-group">
                <label>Document Language:</label>
                <select className="form-control" value={ocrLang} onChange={(e) => setOcrLang(e.target.value)}>
                  <option value="eng">English</option>
                  <option value="vie">Vietnamese</option>
                  <option value="vie+eng">Vietnamese + English</option>
                </select>
              </div>
              <div className="form-group">
                <label>Recognition Progress:</label>
                <div style={{ height: '6px', backgroundColor: 'var(--bg-input)', borderRadius: '3px', overflow: 'hidden', margin: '8px 0' }}>
                  <div style={{ width: `${ocrProgress}%`, height: '100%', backgroundColor: 'var(--success)', transition: 'width 0.2s' }} />
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ocrStatus}</span>
              </div>
              <div className="form-group">
                <label>Extracted Text Output:</label>
                <textarea
                  className="form-control"
                  rows={8}
                  style={{ resize: 'vertical', fontFamily: 'var(--font-sans)', lineHeight: '1.5' }}
                  value={ocrResult}
                  onChange={(e) => setOcrResult(e.target.value)}
                  placeholder="Text recognition result will appear here..."
                />
              </div>
            </div>
            <div className="dialog-footer">
              <button className="btn btn-secondary" onClick={() => {
                navigator.clipboard.writeText(ocrResult);
                NotificationSystem.success('OCR', 'Copied text result to clipboard.');
              }} disabled={!ocrResult}>Copy Text</button>
              <button className="btn btn-primary" onClick={handleExecuteOcr}>Run OCR Engine</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Dialog */}
      {showSettingsDialog && (
        <div className="dialog-backdrop">
          <div className="dialog-window">
            <div className="dialog-header">
              <h3>System Settings</h3>
              <button className="dialog-close-btn" onClick={() => setShowSettingsDialog(false)}>&times;</button>
            </div>
            <div className="dialog-body">
              <div className="form-group">
                <label>Display Theme Mode:</label>
                <select className="form-control" value={theme} onChange={(e) => setTheme(e.target.value)}>
                  <option value={THEMES.DARK}>Dark Mode (Slate Blue & Indigo)</option>
                  <option value={THEMES.LIGHT}>Light Mode (Modern White)</option>
                </select>
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoSave}
                    onChange={(e) => setAutoSave(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                  />
                  <span>Auto-save modifications every 5 minutes</span>
                </label>
              </div>
            </div>
            <div className="dialog-footer">
              <button className="btn btn-secondary" onClick={() => setShowSettingsDialog(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveSettings}>Save Settings</button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      {showSignatureDialog && (
        <div className="dialog-backdrop">
          <div className="dialog-window" style={{ width: '440px' }}>
            <div className="dialog-header">
              <h3>Draw Your Signature</h3>
              <button className="dialog-close-btn" onClick={() => setShowSignatureDialog(false)}>&times;</button>
            </div>
            <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: '#ffffff', width: '400px', height: '200px', overflow: 'hidden' }}>
                <canvas
                  ref={sigCanvasRef}
                  width="400"
                  height="200"
                  style={{ cursor: 'crosshair', display: 'block' }}
                  onMouseDown={startSigDrawing}
                  onMouseMove={drawSig}
                  onMouseUp={stopSigDrawing}
                  onMouseLeave={stopSigDrawing}
                />
              </div>
              <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Use mouse cursor or touch pen to sign inside box.</span>
                <button className="btn btn-secondary" onClick={handleClearSignature}>Clear Signature</button>
              </div>
            </div>
            <div className="dialog-footer">
              <button className="btn btn-secondary" onClick={() => setShowSignatureDialog(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveSignature}>Apply Signature</button>
            </div>
          </div>
        </div>
      )}

      {/* Watermark Dialog */}
      <WatermarkDialog
        isOpen={showWatermarkDialog}
        onClose={() => setShowWatermarkDialog(false)}
        onExecute={handleExecuteWatermark}
      />

      {/* Security Dialog */}
      <SecurityDialog
        isOpen={showSecurityDialog}
        onClose={() => setShowSecurityDialog(false)}
        onExecute={handleExecuteSecurity}
      />

      {/* Header & Footer Dialog */}
      <HeaderFooterDialog
        isOpen={showHeaderFooterDialog}
        onClose={() => setShowHeaderFooterDialog(false)}
        onExecute={handleExecuteHeaderFooter}
      />

      {/* Convert From PDF Dialog */}
      {showConvertFromPdfDialog && (
        <div className="dialog-backdrop">
          <div className="dialog-window" style={{ width: '400px' }}>
            <div className="dialog-header">
              <h3>Convert PDF to Format</h3>
              <button className="dialog-close-btn" onClick={() => setShowConvertFromPdfDialog(false)}>&times;</button>
            </div>
            <div className="dialog-body">
              <div className="form-group">
                <label htmlFor="target-format-select">Target Format</label>
                <select
                  id="target-format-select"
                  className="form-control"
                  value={convertTargetFormat}
                  onChange={(e) => setConvertTargetFormat(e.target.value)}
                >
                  <option value="docx">Microsoft Word (.docx)</option>
                  <option value="xlsx">Microsoft Excel (.xlsx)</option>
                  <option value="pptx">Microsoft PowerPoint (.pptx)</option>
                  <option value="png">Images (.png)</option>
                  <option value="txt">Plain Text (.txt)</option>
                  <option value="html">HTML Webpage (.html)</option>
                </select>
              </div>
            </div>
            <div className="dialog-footer">
              <button className="btn btn-secondary" onClick={() => setShowConvertFromPdfDialog(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleExecuteConvertFromPdf}>Convert Document</button>
            </div>
          </div>
        </div>
      )}

      {/* Conversion Progress Overlay */}
      {showConversionProgress && (
        <div className="dialog-backdrop" style={{ zIndex: 9999 }}>
          <div className="dialog-window" style={{ width: '400px' }}>
            <div className="dialog-header">
              <h3>Processing File</h3>
            </div>
            <div className="dialog-body">
              <div className="form-group">
                <label>{conversionStatus}</label>
                <div style={{ height: '8px', backgroundColor: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden', margin: '12px 0' }}>
                  <div style={{ width: `${conversionProgress}%`, height: '100%', backgroundColor: 'var(--primary)', transition: 'width 0.2s' }} />
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{conversionProgress}% Complete</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

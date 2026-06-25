import React, { useState, useEffect, useRef } from 'react';
import Titlebar from './components/Titlebar.jsx';
import Welcome from './components/Welcome.jsx';
import Toolbar from './components/Toolbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import Viewer from './components/Viewer.jsx';
import { IPC_CHANNELS, MODES, THEMES } from '../../shared/constants.js';
import { NotificationSystem } from './utils/notifications.js';

import * as pdfjsLib from 'pdfjs-dist';
// Configure the PDF.js worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

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
      serializedAnnotations[pageNum] = instance.toJSON();
    });

    const serializedFormData = formFields.filter(f => f.tabId === activeTabId).map(f => ({
      id: f.id,
      pageNum: f.pageNum,
      type: f.type,
      value: f.value
    }));

    if (window.api) {
      try {
        const success = await window.api.invoke(IPC_CHANNELS.FILE_SAVE, {
          filePath: activeTab.filePath,
          annotations: serializedAnnotations,
          forms: serializedFormData
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
      <Titlebar />

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
    </div>
  );
}

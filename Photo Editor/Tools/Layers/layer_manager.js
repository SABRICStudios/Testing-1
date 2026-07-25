/**
 * Visuals Photo Editor - Layers UI Manager
 * Handles side-panel toggles, dynamic row generation, opacity tracking, editable layer names, and layer hierarchy.
 */

window.LayersEditor = {
    isOpen: false,
    activeLayerId: 1,
    layerCounter: 1,
    layers: [
        { id: 1, name: 'Background Layer', type: 'image', opacity: 100, visible: true, isLocked: true }
    ],
    getActiveLayer: function() {
        const layer = this.layers.find(l => l.id === this.activeLayerId) || this.layers[0];
        // Ensure background layer is safely mapped if canvas was initialized on imgState
        if (layer && layer.id === 1 && !layer.canvas && window.imgState) {
            layer.canvas = window.imgState.imageXCanvas;
            layer.sourceImage = window.imgState.img;
        }
        return layer || null;
    }
};

if (!window.LayerManager) {
    window.LayerManager = window.LayersEditor;
}

document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('layersToggleBtn') || document.querySelector('button[title*="Layers"]');
    const panel = document.getElementById('layersPanel');
    const closeBtn = document.getElementById('closeLayersBtn');
    
    const opacityInput = document.getElementById('layerOpacity');
    const opacityVal = document.getElementById('layerOpacityVal');
    
    const addTransparentBtn = document.getElementById('addTransparentLayerBtn');
    const addBlankBtn = document.getElementById('addBlankLayerBtn');
    const addImageBtn = document.getElementById('addImageLayerBtn');
    const layerFileInput = document.getElementById('layerImageFileInput');

    const deleteBtn = document.getElementById('deleteLayerBtn');
    const upBtn = document.getElementById('moveLayerUpBtn');
    const downBtn = document.getElementById('moveLayerDownBtn');

    /**
     * Resolves or dynamically creates the container for layer item rows
     */
    function getOrCreateListContainer() {
        if (!panel) return null;

        let container = document.getElementById('layersListContainer') || 
                        document.getElementById('layersList') || 
                        panel.querySelector('.layers-list-body');

        if (!container) {
            container = document.createElement('div');
            container.id = 'layersListContainer';
            container.className = 'layers-list-body';
            
            // Neon styling matching "Anime Night City" theme
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '6px';
            container.style.padding = '8px';
            container.style.marginTop = '10px';
            container.style.minHeight = '120px';
            container.style.maxHeight = '220px';
            container.style.overflowY = 'auto';
            container.style.background = '#0f0e17';
            container.style.borderRadius = '8px';
            container.style.border = '1px solid #2d2d3f';
            container.style.width = '100%';
            container.style.boxSizing = 'border-box';

            panel.appendChild(container);
        }
        return container;
    }

    // 2. Open / Toggle Handler
    function toggleLayersPanel(show) {
        if (!panel) return;
        
        const shouldShow = show !== undefined ? show : !window.LayersEditor.isOpen;
        window.LayersEditor.isOpen = shouldShow;

        if (shouldShow) {
            panel.classList.remove('hidden');
            panel.style.display = 'flex';
            panel.style.flexDirection = 'column';
            
            if (typeof window.initLayersEngine === 'function') {
                window.initLayersEngine();
            }
            renderLayersList();
            requestLayersComposite();
        } else {
            panel.classList.add('hidden');
            panel.style.display = 'none';
        }
    }

    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            toggleLayersPanel();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            toggleLayersPanel(false);
        });
    }

    // 3. Dynamic Layer Row Renderer
    function renderLayersList() {
        const container = getOrCreateListContainer();
        if (!container) return;
        
        container.innerHTML = ''; 

        window.LayersEditor.layers.forEach(layer => {
            const isSelected = layer.id === window.LayersEditor.activeLayerId;
            const row = document.createElement('div');
            row.className = `layer-item ${isSelected ? 'active' : ''}`;
            row.setAttribute('data-layer-id', layer.id);
            
            // Row styling
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.padding = '8px 10px';
            row.style.background = isSelected ? '#1f1d2b' : '#14131d';
            row.style.border = isSelected ? '1px solid #00adb5' : '1px solid #2d2d3f';
            row.style.borderRadius = '6px';
            row.style.cursor = 'pointer';
            row.style.userSelect = 'none';
            row.style.transition = 'all 0.15s ease';

            const eyeIcon = layer.visible ? 'fa-eye' : 'fa-eye-slash';
            const eyeColor = layer.visible ? '#00adb5' : '#555';
            const thumbContent = layer.id === 1 ? 'BG' : (layer.type === 'text' ? 'T' : 'IMG');
            const thumbColor = layer.id === 1 ? '#00adb5' : (layer.type === 'text' ? '#ff2a6d' : '#393e46');

            row.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px; flex: 1; overflow: hidden;">
                    <button type="button" class="visibility-btn" style="background: none; border: none; color: ${eyeColor}; cursor: pointer; padding: 2px;">
                        <i class="fa ${eyeIcon}"></i>
                    </button>
                    <div style="width: 26px; height: 26px; background: ${thumbColor}; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #fff; font-size: 10px; flex-shrink: 0;">
                        ${thumbContent}
                    </div>
                    <span class="layer-name-label" style="font-size: 12px; color: ${isSelected ? '#fff' : '#a0a0b0'}; font-weight: ${isSelected ? '600' : 'normal'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1;" title="${layer.name}">
                        ${layer.name}
                    </span>
                    <input type="text" class="layer-name-input" value="${layer.name}" style="display: none; width: 85%; background: #0f0e17; color: #fff; border: 1px solid #00adb5; border-radius: 4px; padding: 2px 6px; font-size: 11px; outline: none;" />
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-left: 8px;">
                    ${!layer.isLocked ? `<i class="fa fa-pencil edit-name-btn" style="color: #777; font-size: 11px; cursor: pointer;" title="Rename Layer"></i>` : ''}
                    <i class="fa ${layer.isLocked ? 'fa-lock' : 'fa-bars'}" style="color: #444; font-size: 11px;"></i>
                </div>
            `;

            
            // Select Layer Handler
// Select Layer Handler
row.addEventListener('click', (e) => {
    if (e.target.closest('.visibility-btn') || e.target.closest('.edit-name-btn') || e.target.classList.contains('layer-name-input')) return;

    // 1. Save current active layer state & parameters
    const currentActive = window.LayersEditor.getActiveLayer();
    if (currentActive) {
        currentActive.x = window.imgState.x;
        currentActive.y = window.imgState.y;
        currentActive.width = window.imgState.width;
        currentActive.height = window.imgState.height;
        currentActive.rotation = window.imgState.rotation;
        
        if (window.HistoryManager && typeof window.HistoryManager.getCurrentParameters === 'function') {
            currentActive.parameters = window.HistoryManager.getCurrentParameters();
        }
    }

    // 2. Switch Active Layer ID
    window.LayersEditor.activeLayerId = layer.id;
    const newActive = window.LayersEditor.getActiveLayer();

    // 3. Restore Layer Transforms to imgState
    window.imgState.x = layer.x !== undefined ? layer.x : 0;
    window.imgState.y = layer.y !== undefined ? layer.y : 0;
    window.imgState.width = layer.width || (layer.canvas ? layer.canvas.width : window.imgState.width);
    window.imgState.height = layer.height || (layer.canvas ? layer.canvas.height : window.imgState.height);
    window.imgState.rotation = layer.rotation !== undefined ? layer.rotation : 0;

    // 4. Ensure layer has default parameters if none exist
    if (!layer.parameters) {
        layer.parameters = JSON.parse(JSON.stringify(window.HistoryManager.defaultState));
    }

    // 5. Inject newly selected layer's parameters into HistoryManager timeline pointer
    if (window.HistoryManager && window.HistoryManager.historyStack[window.HistoryManager.currentIndex]) {
        window.HistoryManager.historyStack[window.HistoryManager.currentIndex].state = JSON.parse(JSON.stringify(layer.parameters));
        window.HistoryManager.syncSubManagersToCurrentCheckpoint();
    }

    // 6. Sync UI Sliders (Exposure, Brightness, Opacity, etc.)
    if (opacityInput) {
        opacityInput.value = (layer.opacity <= 1 ? layer.opacity * 100 : layer.opacity);
    }
    if (opacityVal) {
        opacityVal.textContent = Math.round(opacityInput ? opacityInput.value : 100) + '%';
    }

    // Call helper to force UI sliders to reflect current parameters
    if (typeof syncAllUISlidersFromState === 'function') {
        syncAllUISlidersFromState(layer.parameters);
    }

    renderLayersList();
    requestLayersComposite();
});
            // Visibility Toggle Handler
            const visBtn = row.querySelector('.visibility-btn');
            visBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                layer.visible = !layer.visible;
                requestLayersComposite();
                renderLayersList();
            });

            // Inline Renaming Logic
            const labelEl = row.querySelector('.layer-name-label');
            const inputEl = row.querySelector('.layer-name-input');
            const editBtn = row.querySelector('.edit-name-btn');

            const startEditing = (e) => {
                if (layer.isLocked) return;
                e?.stopPropagation();
                
                labelEl.style.display = 'none';
                inputEl.style.display = 'block';
                inputEl.focus();
                inputEl.select();
            };

            const saveEditing = () => {
                const updatedVal = inputEl.value.trim();
                if (updatedVal.length > 0) {
                    layer.name = updatedVal;
                }
                labelEl.textContent = layer.name;
                labelEl.style.display = 'block';
                inputEl.style.display = 'none';
            };

            if (!layer.isLocked) {
                editBtn?.addEventListener('click', startEditing);
                labelEl.addEventListener('dblclick', startEditing);

                inputEl.addEventListener('blur', saveEditing);
                inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') saveEditing();
                    if (e.key === 'Escape') {
                        inputEl.value = layer.name;
                        labelEl.style.display = 'block';
                        inputEl.style.display = 'none';
                    }
                });
            }

            container.appendChild(row);
        });
    }

    // 4. Opacity Input Controls
    if (opacityInput) {
        opacityInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            if (opacityVal) opacityVal.textContent = val + '%';
            
            let activeLayer = window.LayersEditor.layers.find(l => l.id === window.LayersEditor.activeLayerId);
            if (activeLayer) {
                activeLayer.opacity = val / 100; // Normalized opacity (0.0 to 1.0) for canvas composite
                requestLayersComposite();
            }
        });
    }

    // 5. Sequential Layer Creation (Layer 1, Layer 2...)
// Helper function to create layers based on type ('transparent' | 'blank' | 'image')
   // Helper function to create layers based on type ('transparent' | 'blank' | 'image')
function createNewLayer(type = 'transparent', options = {}) {
    const newId = Date.now();
    const editorCanvas = document.getElementById('editorCanvas');
    
    // Canvas target bounds
    const canvasW = editorCanvas ? editorCanvas.width : (window.imgState?.width || 800);
    const canvasH = editorCanvas ? editorCanvas.height : (window.imgState?.height || 600);

    let layerCanvas = document.createElement('canvas');
    let sourceImg = null;
    let defaultName = `Layer ${window.LayersEditor.layerCounter++}`;
    
    let layerX = 0;
    let layerY = 0;
    let layerW = canvasW;
    let layerH = canvasH;

    if (type === 'blank') {
        layerCanvas.width = canvasW;
        layerCanvas.height = canvasH;
        const ctx = layerCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasW, canvasH);
        defaultName = `White Canvas ${window.LayersEditor.layerCounter - 1}`;

        sourceImg = new Image();
        sourceImg.src = layerCanvas.toDataURL();

    } else if (type === 'image' && options.imgElement) {
        const img = options.imgElement;
        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;

        // Maintain Native Image Aspect Ratio (No Stretching)
        layerCanvas.width = imgW;
        layerCanvas.height = imgH;
        const ctx = layerCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0, imgW, imgH);

        // Fit proportionally within Canvas
        const scale = Math.min(canvasW / imgW, canvasH / imgH, 1.0);
        layerW = Math.round(imgW * scale);
        layerH = Math.round(imgH * scale);

        // Center on Canvas
        layerX = Math.round((canvasW - layerW) / 2);
        layerY = Math.round((canvasH - layerH) / 2);

        defaultName = options.name || `Image Layer ${window.LayersEditor.layerCounter - 1}`;
        sourceImg = img;

    } else if (type === 'transparent') {
        layerCanvas.width = canvasW;
        layerCanvas.height = canvasH;
        defaultName = `Transparent Layer ${window.LayersEditor.layerCounter - 1}`;
    }

    const originalCanvas = document.createElement('canvas');
    originalCanvas.width = layerCanvas.width;
    originalCanvas.height = layerCanvas.height;
    originalCanvas.getContext('2d').drawImage(layerCanvas, 0, 0);

    const newLayer = {
        id: newId,
        name: options.name || defaultName,
        type: type,
        opacity: 1.0,
        visible: true,
        isLocked: false,
        canvas: layerCanvas,
        originalCanvas: originalCanvas,
        sourceImage: sourceImg,
        x: layerX,
        y: layerY,
        width: layerW,
        height: layerH,
        rotation: 0,
        parameters: window.HistoryManager ? JSON.parse(JSON.stringify(window.HistoryManager.getCurrentParameters())) : {}
    };

    window.LayersEditor.layers.unshift(newLayer);
    window.LayersEditor.activeLayerId = newId;

    // Direct Sync active state so selection outline aligns immediately
    window.imgState.x = layerX;
    window.imgState.y = layerY;
    window.imgState.width = layerW;
    window.imgState.height = layerH;
    window.imgState.rotation = 0;

    renderLayersList();
    requestLayersComposite();
}

    // 5. Layer Type Action Handlers
    addTransparentBtn?.addEventListener('click', () => {
        createNewLayer('transparent');
    });

// Blank / White Canvas Button Click
    addBlankBtn?.addEventListener('click', () => {
        createNewLayer('blank');
    });

    if (addImageBtn && layerFileInput) {
        addImageBtn.addEventListener('click', () => layerFileInput.click());

        layerFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(event) {
                const img = new Image();
                img.onload = function() {
                    createNewLayer('image', {
                        imgElement: img,
                        name: file.name
                    });
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
            layerFileInput.value = ''; // Reset input selection
        });
    }

    // 6. Layer Deletion
    deleteBtn?.addEventListener('click', () => {
        const activeLayer = window.LayersEditor.layers.find(l => l.id === window.LayersEditor.activeLayerId);
        
        if (activeLayer?.isLocked || window.LayersEditor.activeLayerId === 1) {
            alert("Cannot delete primary Background layer!");
            return;
        }
        
        const layerToDelete = window.LayersEditor.activeLayerId;
        window.LayersEditor.layers = window.LayersEditor.layers.filter(l => l.id !== layerToDelete);
        window.LayersEditor.activeLayerId = 1;

        if (typeof window.removeEngineLayerTrack === 'function') {
            window.removeEngineLayerTrack(layerToDelete);
        }
        
        renderLayersList();
        requestLayersComposite();
    });

    // 7. Layer Reordering Controls
    upBtn?.addEventListener('click', () => {
        const idx = window.LayersEditor.layers.findIndex(l => l.id === window.LayersEditor.activeLayerId);
        if (idx > 0) {
            let targetElement = window.LayersEditor.layers[idx];
            window.LayersEditor.layers[idx] = window.LayersEditor.layers[idx - 1];
            window.LayersEditor.layers[idx - 1] = targetElement;
            renderLayersList();
            requestLayersComposite();
        }
    });

    downBtn?.addEventListener('click', () => {
        const idx = window.LayersEditor.layers.findIndex(l => l.id === window.LayersEditor.activeLayerId);
        if (idx !== -1 && idx < window.LayersEditor.layers.length - 1) {
            if (window.LayersEditor.layers[idx + 1].isLocked) return;
            
            let targetElement = window.LayersEditor.layers[idx];
            window.LayersEditor.layers[idx] = window.LayersEditor.layers[idx + 1];
            window.LayersEditor.layers[idx + 1] = targetElement;
            renderLayersList();
            requestLayersComposite();
        }
    });

    function requestLayersComposite() {
        if (window.CanvasEditor && typeof window.CanvasEditor.applyEffectsPipeline === 'function') {
            window.CanvasEditor.applyEffectsPipeline();
        } else if (typeof window.drawLayersCompositeLoop === 'function') {
            window.drawLayersCompositeLoop();
        } else if (window.CanvasEditor && typeof window.CanvasEditor.redraw === 'function') {
            window.CanvasEditor.redraw();
        }
    }

    // Auto-render list UI immediately on load
    renderLayersList();
});
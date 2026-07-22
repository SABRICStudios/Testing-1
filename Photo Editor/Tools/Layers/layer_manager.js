/**
 * Visuals Photo Editor - Layers UI Manager
 * Handles side-panel toggles, dynamic row generation, opacity tracking, editable layer names, and layer hierarchy.
 */

window.LayersEditor = {
    isOpen: false,
    activeLayerId: 1,
    layerCounter: 1, // Auto-increments layer names (Layer 1, Layer 2...)
    layers: [
        { id: 1, name: 'Background Layer', type: 'image', opacity: 100, visible: true, isLocked: true }
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('layersToggleBtn') || document.querySelector('button[title*="Layers"]');
    const panel = document.getElementById('layersPanel');
    const closeBtn = document.getElementById('closeLayersBtn');
    
    const opacityInput = document.getElementById('layerOpacity');
    const opacityVal = document.getElementById('layerOpacityVal');
    
    const addBtn = document.getElementById('addNewLayerBtn') || document.getElementById('addLayerBtn');
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
            row.addEventListener('click', (e) => {
                if (e.target.closest('.visibility-btn') || e.target.closest('.edit-name-btn') || e.target.classList.contains('layer-name-input')) return;
                
                window.LayersEditor.activeLayerId = layer.id;
                
                if (opacityInput) opacityInput.value = layer.opacity;
                if (opacityVal) opacityVal.textContent = layer.opacity + '%';
                
                renderLayersList();
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
                activeLayer.opacity = val;
                requestLayersComposite();
            }
        });
    }

    // 5. Sequential Layer Creation (Layer 1, Layer 2...)
    addBtn?.addEventListener('click', () => {
        const newId = Date.now();
        const layerName = `Layer ${window.LayersEditor.layerCounter++}`;
        
        window.LayersEditor.layers.unshift({
            id: newId,
            name: layerName,
            type: 'text',
            opacity: 100,
            visible: true,
            isLocked: false
        });
        
        window.LayersEditor.activeLayerId = newId;
        
        if (typeof window.createEngineLayerTrack === 'function') {
            window.createEngineLayerTrack(newId);
        }
        
        renderLayersList();
        requestLayersComposite();
    });

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
        if (typeof window.drawLayersCompositeLoop === 'function') {
            window.drawLayersCompositeLoop();
        } else if (window.CanvasEditor && typeof window.CanvasEditor.redraw === 'function') {
            window.CanvasEditor.redraw();
        }
    }

    // Auto-render list UI immediately on load
    renderLayersList();
});
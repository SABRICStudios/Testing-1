/**
 * Visuals Photo Editor - Layers UI Manager
 * Handles side-panel rendering, row generation, opacity tracking, and ordering actions.
 */

let LayersEditor = {
    isOpen: false,
    activeLayerId: null,
    // Layer schema array holding state records
    layers: [
        { id: 2, name: 'Watermark Text', type: 'text', opacity: 100, visible: true },
        { id: 1, name: 'Background.jpg', type: 'image', opacity: 100, visible: true }
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    // Selectors
    const toggleBtn = document.getElementById('layersToggleBtn');
    const panel = document.getElementById('layersPanel');
    const closeBtn = document.getElementById('closeLayersBtn');
    const listContainer = document.getElementById('layersListContainer');
    
    const opacityInput = document.getElementById('layerOpacity');
    const opacityVal = document.getElementById('layerOpacityVal');
    
    const addBtn = document.getElementById('addNewLayerBtn');
    const deleteBtn = document.getElementById('deleteLayerBtn');
    const upBtn = document.getElementById('moveLayerUpBtn');
    const downBtn = document.getElementById('moveLayerDownBtn');

    if (!toggleBtn || !panel) return;

    // Default to background layer as active initially
    LayersEditor.activeLayerId = 1;

    // 1. Toggle Panel Visibility
    toggleBtn.addEventListener('click', () => {
        if (LayersEditor.isOpen) {
            panel.style.display = 'none';
            LayersEditor.isOpen = false;
        } else {
            panel.style.display = 'block';
            LayersEditor.isOpen = true;
            renderLayersList();
            
            if (typeof initLayersEngine === 'function') {
                initLayersEngine();
            }
        }
    });

    closeBtn.addEventListener('click', () => {
        panel.style.display = 'none';
        LayersEditor.isOpen = false;
    });

    // 2. Generate and Render Layer Row Elements Dynamically
    function renderLayersList() {
        listContainer.innerHTML = ''; // Wipe mock elements

        LayersEditor.layers.forEach(layer => {
            const isSelected = layer.id === LayersEditor.activeLayerId;
            const row = document.createElement('div');
            row.className = `layer-item ${isSelected ? 'active' : ''}`;
            row.setAttribute('data-layer-id', layer.id);
            
            // Inline styling to maintain dark anime theme matching your layout
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.justifyContent = 'space-between';
            row.style.padding = '8px';
            row.style.background = isSelected ? '#252525' : '#1e1e1e';
            row.style.border = isSelected ? '1px solid #00adb5' : '1px solid #2d2d2d';
            row.style.borderRadius = '4px';
            row.style.cursor = 'pointer';

            const eyeIcon = layer.visible ? 'fa-eye' : 'fa-eye-slash';
            const eyeColor = layer.visible ? '#00adb5' : '#666';
            const thumbContent = layer.type === 'text' ? 'T' : '';
            const thumbColor = layer.type === 'text' ? '#00adb5' : '#333';

            row.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button type="button" class="visibility-btn" style="background: none; border: none; color: ${eyeColor}; cursor: pointer; padding: 0;">
                        <i class="fa ${eyeIcon}"></i>
                    </button>
                    <div style="width: 32px; height: 32px; background: ${thumbColor}; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #00adb5; font-size: 12px;">
                        ${thumbContent}
                    </div>
                    <span style="font-size: 12px; color: ${isSelected ? '#fff' : '#aaa'}; font-weight: ${isSelected ? 'bold' : 'normal'};">${layer.name}</span>
                </div>
                <i class="fa ${layer.id === 1 ? 'fa-lock' : 'fa-bars'}" style="color: #444; font-size: 12px;"></i>
            `;

            // Row Interaction (Selecting Layer)
            row.addEventListener('click', (e) => {
                // Prevent selection event if visibility button specifically is clicked
                if (e.target.closest('.visibility-btn')) return;
                
                LayersEditor.activeLayerId = layer.id;
                opacityInput.value = layer.opacity;
                opacityVal.textContent = layer.opacity + '%';
                renderLayersList();
            });

            // Layer Toggle Hide/Show Click event
            const visBtn = row.querySelector('.visibility-btn');
            visBtn.addEventListener('click', () => {
                layer.visible = !layer.visible;
                requestLayersComposite();
                renderLayersList();
            });

            listContainer.appendChild(row);
        });
    }

    // 3. Opacity Slider Adjustment Handler
    opacityInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        opacityVal.textContent = val + '%';
        
        let activeLayer = LayersEditor.layers.find(l => l.id === LayersEditor.activeLayerId);
        if (activeLayer) {
            activeLayer.opacity = val;
            requestLayersComposite();
        }
    });

    // 4. Operation Control Elements: Add, Delete, Reorder Actions
    addBtn.addEventListener('click', () => {
        const newId = Date.now(); // Generate clean unique timestamp ID
        LayersEditor.layers.unshift({
            id: newId,
            name: `Layer ${LayersEditor.layers.length + 1}`,
            type: 'image',
            opacity: 100,
            visible: true
        });
        LayersEditor.activeLayerId = newId;
        
        if (typeof createEngineLayerTrack === 'function') {
            createEngineLayerTrack(newId);
        }
        
        renderLayersList();
        requestLayersComposite();
    });

    deleteBtn.addEventListener('click', () => {
        if (LayersEditor.activeLayerId === 1) {
            alert("Cannot delete primary Background layer!");
            return;
        }
        
        LayersEditor.layers = LayersEditor.layers.filter(l => l.id !== LayersEditor.activeLayerId);
        LayersEditor.activeLayerId = 1; // Fallback back down to primary base frame
        
        renderLayersList();
        requestLayersComposite();
    });

    upBtn.addEventListener('click', () => {
        const idx = LayersEditor.layers.findIndex(l => l.id === LayersEditor.activeLayerId);
        if (idx > 0) { // Can't move top item up further
            let targetElement = LayersEditor.layers[idx];
            LayersEditor.layers[idx] = LayersEditor.layers[idx - 1];
            LayersEditor.layers[idx - 1] = targetElement;
            renderLayersList();
            requestLayersComposite();
        }
    });

    downBtn.addEventListener('click', () => {
        const idx = LayersEditor.layers.findIndex(l => l.id === LayersEditor.activeLayerId);
        if (idx !== -1 && idx < LayersEditor.layers.length - 1) {
            // Cannot drop things past locked structural background boundary row
            if (LayersEditor.layers[idx].id === 1 || LayersEditor.layers[idx + 1].id === 1) return;
            
            let targetElement = LayersEditor.layers[idx];
            LayersEditor.layers[idx] = LayersEditor.layers[idx + 1];
            LayersEditor.layers[idx + 1] = targetElement;
            renderLayersList();
            requestLayersComposite();
        }
    });

    function requestLayersComposite() {
        if (typeof drawLayersCompositeLoop === 'function') {
            drawLayersCompositeLoop();
        }
    }
});
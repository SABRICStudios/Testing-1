/**
 * Visuals Photo Editor - Selection UI & Event Manager
 * Handles UI interactions, unified drag/move logic for both panel states,
 * touch/mouse listeners, and selection engine hooks.
 */

window.SelectionEditor = {
    isOpen: false,
    activeMode: 'rect',    // 'rect' | 'ellipse' | 'lasso' | 'polygonal' | 'wand' | 'brush' | 'subject' | 'eyedropper'
    combineOp: 'new',      // 'new' | 'add' | 'subtract'
    featherRadius: 0,
    wandTolerance: 32,
    brushRadius: 20,
    
    isDrawing: false,
    startCoords: { x: 0, y: 0 },
    currentCoords: { x: 0, y: 0 },
    lassoPoints: [],
    polyPoints: []          // Coordinates for Polygonal Lasso
};

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const selectionBtn = document.getElementById('selectionToolBtn');
    const selectionPanel = document.getElementById('selectionPanel');
    const selectionPanelMini = document.getElementById('selectionPanelMini');
    
    const modeButtons = document.querySelectorAll('.selection-mode-btn');
    const opButtons = document.querySelectorAll('.op-btn');
    const featherInput = document.getElementById('selectionFeather');
    const featherVal = document.getElementById('selectionFeatherVal');
    
    // Header & Footer Action Buttons
    const minimizeBtn = document.getElementById('minimizeSelectionBtn');
    const expandBtn = document.getElementById('expandSelectionBtn');
    const confirmBtn = document.getElementById('confirmSelectionBtn');
    const discardBtn = document.getElementById('discardSelectionBtn');

    // Context Controls
    const wandControls = document.getElementById('wandControls');
    const wandToleranceInput = document.getElementById('wandTolerance');
    const wandToleranceVal = document.getElementById('wandToleranceVal');

    const brushControls = document.getElementById('brushSizeControls');
    const brushSizeInput = document.getElementById('selectionBrushSize');
    const brushSizeVal = document.getElementById('selectionBrushSizeVal');

    const mainCanvas = document.getElementById('editorCanvas');
    if (!selectionPanel || !mainCanvas) return;

    // --- Unified Panel Dragging Engine ---
    function enablePanelDragging(targetPanel) {
        let isDragging = false;
        let startX = 0, startY = 0;
        let initialLeft = 0, initialTop = 0;

        function handleDragStart(clientX, clientY, eventTarget) {
            // Ignore drag action if user clicks an interactive input or button directly
            if (eventTarget.closest('button, input, select, textarea, label, .op-btn, .selection-mode-btn')) {
                return false;
            }

            isDragging = true;
            startX = clientX;
            startY = clientY;

            const rect = targetPanel.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            targetPanel.style.cursor = 'grabbing';
            return true;
        }

        function handleDragMove(clientX, clientY) {
            if (!isDragging) return;

            const dx = clientX - startX;
            const dy = clientY - startY;

            const newLeft = initialLeft + dx;
            const newTop = initialTop + dy;

            // Update active panel position
            targetPanel.style.left = `${newLeft}px`;
            targetPanel.style.top = `${newTop}px`;

            // Keep spatial position perfectly synced across expanded/minimized states
            if (targetPanel === selectionPanel && selectionPanelMini) {
                selectionPanelMini.style.left = `${newLeft}px`;
                selectionPanelMini.style.top = `${newTop}px`;
            } else if (targetPanel === selectionPanelMini && selectionPanel) {
                selectionPanel.style.left = `${newLeft}px`;
                selectionPanel.style.top = `${newTop}px`;
            }
        }

        function handleDragEnd() {
            if (isDragging) {
                isDragging = false;
                targetPanel.style.cursor = 'grab';
            }
        }

        targetPanel.style.cursor = 'grab';

        // Mouse Listeners
        targetPanel.addEventListener('mousedown', (e) => handleDragStart(e.clientX, e.clientY, e.target));
        window.addEventListener('mousemove', (e) => handleDragMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', handleDragEnd);

        // Touch Listeners
        targetPanel.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                handleDragStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
            }
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });

        window.addEventListener('touchend', handleDragEnd);
    }

    // Attach drag listener to both main panel and mini UI
    enablePanelDragging(selectionPanel);
    if (selectionPanelMini) {
        enablePanelDragging(selectionPanelMini);
    }

    // --- Toggle & Panel Display Logic ---
    if (selectionBtn) {
        selectionBtn.addEventListener('click', () => {
            SelectionEditor.isOpen = !SelectionEditor.isOpen;
            
            if (SelectionEditor.isOpen) {
                selectionPanel.style.display = 'block';
                if (selectionPanelMini) selectionPanelMini.style.display = 'none';
                if (typeof initSelectionEngine === 'function') initSelectionEngine();
            } else {
                // Hiding UI should keep active mask working in background
                selectionPanel.style.display = 'none';
                if (selectionPanelMini) selectionPanelMini.style.display = 'none';
            if (window.CanvasEditor && typeof window.CanvasEditor.applyEffectsPipeline === 'function') {
            window.CanvasEditor.applyEffectsPipeline();
        }

            }
        });
    }

    // Minimize Handler
    if (minimizeBtn && selectionPanelMini) {
        minimizeBtn.addEventListener('click', () => {
            selectionPanelMini.style.top = selectionPanel.style.top;
            selectionPanelMini.style.left = selectionPanel.style.left;
            selectionPanel.style.display = 'none';
            selectionPanelMini.style.display = 'flex';
        });
    }

    // Expand Handler
    const expandPanel = () => {
        if (selectionPanelMini) selectionPanelMini.style.display = 'none';
        if (selectionPanel) {
            selectionPanel.style.top = selectionPanelMini.style.top;
            selectionPanel.style.left = selectionPanelMini.style.left;
            selectionPanel.style.display = 'block';
        }
    };

    if (expandBtn) expandBtn.addEventListener('click', expandPanel);

    // Confirm Action: Lock selection mask and close UI
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            SelectionEditor.isOpen = false;
            selectionPanel.style.display = 'none';
            if (selectionPanelMini) selectionPanelMini.style.display = 'none';
            
            if (window.CanvasEditor && typeof window.CanvasEditor.applyEffectsPipeline === 'function') {
                window.CanvasEditor.applyEffectsPipeline();
            }
        });
    }

    // Discard Action: Clear mask and close UI
    if (discardBtn) {
        discardBtn.addEventListener('click', () => {
            SelectionEditor.isOpen = false;
            selectionPanel.style.display = 'none';
            if (selectionPanelMini) selectionPanelMini.style.display = 'none';

            if (typeof clearActiveSelection === 'function') clearActiveSelection();
            
            if (window.CanvasEditor && typeof window.CanvasEditor.applyEffectsPipeline === 'function') {
                window.CanvasEditor.applyEffectsPipeline();
            }
        });
    }

    // Mode Switcher Buttons
    modeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            modeButtons.forEach(b => {
                b.classList.remove('active');
                b.style.borderColor = '#333';
                b.style.color = '#aaa';
            });

            const target = e.currentTarget;
            target.classList.add('active');
            target.style.borderColor = '#00adb5';
            target.style.color = '#fff';

            SelectionEditor.activeMode = target.getAttribute('data-mode') || 'rect';

            // Context Controls Visibility
            if (wandControls) {
                wandControls.style.display = (SelectionEditor.activeMode === 'wand' || SelectionEditor.activeMode === 'eyedropper') ? 'block' : 'none';
            }
            if (brushControls) {
                brushControls.style.display = (SelectionEditor.activeMode === 'brush') ? 'block' : 'none';
            }

            if (SelectionEditor.activeMode === 'subject') {
                if (typeof processAutoSubjectSelection === 'function') {
                    processAutoSubjectSelection();
                }
            }
        });
    });

    // Combine Operation Switcher (New / Add / Subtract)
    opButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            opButtons.forEach(b => {
                b.classList.remove('active');
                b.style.background = 'transparent';
                b.style.color = '#888';
            });
            const target = e.currentTarget;
            target.classList.add('active');
            target.style.background = '#2a2a2a';
            target.style.color = '#fff';

            SelectionEditor.combineOp = target.getAttribute('data-op') || 'new';
        });
    });

    // Parameter Sliders
    if (featherInput && featherVal) {
        featherInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            featherVal.textContent = val + 'px';
            SelectionEditor.featherRadius = val;
            if (typeof requestSelectionOverlayRender === 'function') requestSelectionOverlayRender();
        });
    }

    if (wandToleranceInput && wandToleranceVal) {
        wandToleranceInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            wandToleranceVal.textContent = val;
            SelectionEditor.wandTolerance = val;
        });
    }

    if (brushSizeInput && brushSizeVal) {
        brushSizeInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            brushSizeVal.textContent = val + 'px';
            SelectionEditor.brushRadius = val;
        });
    }

    // Helper: Normalize Canvas Coordinates
    function getCanvasCoords(e) {
        const rect = mainCanvas.getBoundingClientRect();
        const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
        const scaleX = mainCanvas.width / rect.width;
        const scaleY = mainCanvas.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    // Pointer Event Handlers
    function handlePointerDown(e) {
        if (!SelectionEditor.isOpen) return;
        const coords = getCanvasCoords(e);

        SelectionEditor.isDrawing = true;
        SelectionEditor.startCoords = coords;
        SelectionEditor.currentCoords = coords;

        if (SelectionEditor.activeMode === 'lasso' || SelectionEditor.activeMode === 'brush') {
            SelectionEditor.lassoPoints = [coords];
        } else if (SelectionEditor.activeMode === 'polygonal') {
            SelectionEditor.polyPoints.push(coords);
        } else if (SelectionEditor.activeMode === 'wand' || SelectionEditor.activeMode === 'eyedropper') {
            if (typeof processColorSelection === 'function') {
                processColorSelection(
                    coords.x, 
                    coords.y, 
                    SelectionEditor.wandTolerance, 
                    SelectionEditor.activeMode === 'eyedropper'
                );
            }
            SelectionEditor.startCoords = coords;
            SelectionEditor.currentCoords = { x: coords.x + 1, y: coords.y + 1 };
            SelectionEditor.isDrawing = false;
            return;
        }

        if (typeof requestSelectionOverlayRender === 'function') requestSelectionOverlayRender();
    }

    function handlePointerMove(e) {
        if (!SelectionEditor.isOpen || !SelectionEditor.isDrawing) return;
        const coords = getCanvasCoords(e);
        SelectionEditor.currentCoords = coords;

        if (SelectionEditor.activeMode === 'lasso' || SelectionEditor.activeMode === 'brush') {
            SelectionEditor.lassoPoints.push(coords);
        }

        if (typeof requestSelectionOverlayRender === 'function') requestSelectionOverlayRender();
    }

    function handlePointerUp() {
        if (!SelectionEditor.isOpen || !SelectionEditor.isDrawing) return;
        SelectionEditor.isDrawing = false;

        if (SelectionEditor.activeMode === 'lasso' && SelectionEditor.lassoPoints.length > 2) {
            SelectionEditor.lassoPoints.push({ ...SelectionEditor.lassoPoints[0] });
        }

        if (typeof finalizeSelectionArea === 'function') finalizeSelectionArea();
    }

    // Canvas Input Listeners
    mainCanvas.addEventListener('mousedown', handlePointerDown);
    mainCanvas.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    mainCanvas.addEventListener('touchstart', handlePointerDown, { passive: true });
    mainCanvas.addEventListener('touchmove', handlePointerMove, { passive: true });
    window.addEventListener('touchend', handlePointerUp);

    mainCanvas.addEventListener('dblclick', () => {
        if (SelectionEditor.activeMode === 'polygonal' && SelectionEditor.polyPoints.length > 2) {
            SelectionEditor.polyPoints.push({ ...SelectionEditor.polyPoints[0] });
            if (typeof finalizeSelectionArea === 'function') finalizeSelectionArea();
        }
    });
});
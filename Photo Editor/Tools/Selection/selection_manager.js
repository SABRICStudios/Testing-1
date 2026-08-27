/**
 * Visuals Photo Editor - Selection UI & Event Manager
 * Handles UI interactions, unified drag/move logic for both panel states,
 * touch/mouse listeners, and selection engine hooks.
 */

window.SelectionEditor = {
    isOpen: false,
    activeMode: 'rect',
    combineOp: 'new',
    featherRadius: 0,
    wandTolerance: 32,
    brushRadius: 20,
    isDrawing: false,
    startCoords: { x: 0, y: 0 },
    currentCoords: { x: 0, y: 0 },
    lassoPoints: [],
    polyPoints: []
};

if (typeof window.selectionProcessingActive !== 'boolean') {
    window.selectionProcessingActive = false;
}

document.addEventListener('DOMContentLoaded', () => {
    const selectionBtn = document.getElementById('selectionToolBtn');
    const selectionPanel = document.getElementById('selectionPanel');
    const selectionPanelMini = document.getElementById('selectionPanelMini');

    const modeButtons = document.querySelectorAll('.selection-mode-btn');
    const opButtons = document.querySelectorAll('.op-btn');
    const featherInput = document.getElementById('selectionFeather');
    const featherVal = document.getElementById('selectionFeatherVal');

    const minimizeBtn = document.getElementById('minimizeSelectionBtn');
    const expandBtn = document.getElementById('expandSelectionBtn');
    const confirmBtn = document.getElementById('confirmSelectionBtn');
    const discardBtn = document.getElementById('discardSelectionBtn');

    const wandControls = document.getElementById('wandControls');
    const wandToleranceInput = document.getElementById('wandTolerance');
    const wandToleranceVal = document.getElementById('wandToleranceVal');

    const brushControls = document.getElementById('brushSizeControls');
    const brushSizeInput = document.getElementById('selectionBrushSize');
    const brushSizeVal = document.getElementById('selectionBrushSizeVal');

    const mainCanvas = document.getElementById('editorCanvas');

    if (!selectionPanel || !mainCanvas) return;

    function enablePanelDragging(targetPanel) {
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let initialLeft = 0;
        let initialTop = 0;

        function handleDragStart(clientX, clientY, eventTarget) {
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

            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;

            const panelWidth = targetPanel.offsetWidth;
            const panelHeight = targetPanel.offsetHeight;

            const maxLeft = Math.max(0, window.innerWidth - panelWidth);
            const maxTop = Math.max(0, window.innerHeight - panelHeight);

            newLeft = Math.max(0, Math.min(newLeft, maxLeft));
            newTop = Math.max(0, Math.min(newTop, maxTop));

            targetPanel.style.left = `${newLeft}px`;
            targetPanel.style.top = `${newTop}px`;

            if (targetPanel === selectionPanel && selectionPanelMini) {
                selectionPanelMini.style.left = `${newLeft}px`;
                selectionPanelMini.style.top = `${newTop}px`;
            } else if (targetPanel === selectionPanelMini && selectionPanel) {
                selectionPanel.style.left = `${newLeft}px`;
                selectionPanel.style.top = `${newTop}px`;
            }
        }

        function handleDragEnd() {
            if (!isDragging) return;
            isDragging = false;
            targetPanel.style.cursor = 'grab';
        }

        targetPanel.style.cursor = 'grab';

        targetPanel.addEventListener('mousedown', e => {
            handleDragStart(e.clientX, e.clientY, e.target);
        });

        window.addEventListener('mousemove', e => {
            handleDragMove(e.clientX, e.clientY);
        });

        window.addEventListener('mouseup', handleDragEnd);

        targetPanel.addEventListener('touchstart', e => {
            if (e.touches.length > 0) {
                handleDragStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
            }
        }, { passive: true });

        window.addEventListener('touchmove', e => {
            if (e.touches.length > 0) {
                handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });

        window.addEventListener('touchend', handleDragEnd);
    }

    enablePanelDragging(selectionPanel);

    if (selectionPanelMini) {
        enablePanelDragging(selectionPanelMini);
    }

    function openSelectionUI() {
        SelectionEditor.isOpen = true;
        window.selectionProcessingActive = true;

        selectionPanel.style.display = 'block';

        if (selectionPanelMini) {
            selectionPanelMini.style.display = 'none';
        }

        if (typeof initSelectionEngine === 'function') {
            initSelectionEngine();
        }

        if (typeof requestSelectionOverlayRender === 'function') {
            requestSelectionOverlayRender();
        }
    }

    function closeSelectionUI() {
        SelectionEditor.isOpen = false;
        window.selectionProcessingActive = false;

        SelectionEditor.isDrawing = false;
        SelectionEditor.lassoPoints = [];
        SelectionEditor.polyPoints = [];

        selectionPanel.style.display = 'none';

        if (selectionPanelMini) {
            selectionPanelMini.style.display = 'none';
        }

        if (typeof requestSelectionOverlayRender === 'function') {
            requestSelectionOverlayRender();
        }
    }

    if (selectionBtn) {
        selectionBtn.addEventListener('click', () => {
            if (SelectionEditor.isOpen) {
                closeSelectionUI();
            } else {
                openSelectionUI();
            }
        });
    }

    if (minimizeBtn && selectionPanelMini) {
        minimizeBtn.addEventListener('click', e => {
            e.stopPropagation();

            selectionPanelMini.style.top = selectionPanel.style.top;
            selectionPanelMini.style.left = selectionPanel.style.left;

            selectionPanel.style.display = 'none';
            selectionPanelMini.style.display = 'flex';
        });
    }

    const expandPanel = e => {
        if (e) e.stopPropagation();

        if (selectionPanelMini) {
            selectionPanelMini.style.display = 'none';
        }

        if (selectionPanel) {
            selectionPanel.style.top = selectionPanelMini ? selectionPanelMini.style.top : '80px';
            selectionPanel.style.left = selectionPanelMini ? selectionPanelMini.style.left : '20px';
            selectionPanel.style.display = 'block';
        }

        SelectionEditor.isOpen = true;
        window.selectionProcessingActive = true;

        if (typeof requestSelectionOverlayRender === 'function') {
            requestSelectionOverlayRender();
        }
    };

    if (expandBtn) {
        expandBtn.addEventListener('click', expandPanel);
    }

    if (selectionPanelMini) {
        selectionPanelMini.addEventListener('click', e => {
            if (e.target.closest('#expandSelectionBtn')) return;
            expandPanel(e);
        });
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            window.selectionProcessingActive = false;
            SelectionEditor.isOpen = false;
            SelectionEditor.isDrawing = false;

            selectionPanel.style.display = 'none';

            if (selectionPanelMini) {
                selectionPanelMini.style.display = 'none';
            }

            if (typeof requestSelectionOverlayRender === 'function') {
                requestSelectionOverlayRender();
            }

            if (window.CanvasEditor && typeof window.CanvasEditor.applyEffectsPipeline === 'function') {
                window.CanvasEditor.applyEffectsPipeline();
            }
        });
    }

    if (discardBtn) {
        discardBtn.addEventListener('click', () => {
            window.selectionProcessingActive = false;
            SelectionEditor.isOpen = false;
            SelectionEditor.isDrawing = false;

            selectionPanel.style.display = 'none';

            if (selectionPanelMini) {
                selectionPanelMini.style.display = 'none';
            }

            if (typeof clearActiveSelection === 'function') {
                clearActiveSelection();
            }

            if (typeof requestSelectionOverlayRender === 'function') {
                requestSelectionOverlayRender();
            }

            if (window.CanvasEditor && typeof window.CanvasEditor.applyEffectsPipeline === 'function') {
                window.CanvasEditor.applyEffectsPipeline();
            }
        });
    }

    modeButtons.forEach(btn => {
        btn.addEventListener('click', e => {
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
            window.selectionProcessingActive = true;

            if (wandControls) {
                wandControls.style.display =
                    SelectionEditor.activeMode === 'wand' ||
                    SelectionEditor.activeMode === 'eyedropper'
                        ? 'block'
                        : 'none';
            }

            if (brushControls) {
                brushControls.style.display =
                    SelectionEditor.activeMode === 'brush'
                        ? 'block'
                        : 'none';
            }

            if (SelectionEditor.activeMode === 'subject') {
                if (typeof processAutoSubjectSelection === 'function') {
                    processAutoSubjectSelection();
                }
            }

            if (typeof requestSelectionOverlayRender === 'function') {
                requestSelectionOverlayRender();
            }
        });
    });

    opButtons.forEach(btn => {
        btn.addEventListener('click', e => {
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

    if (featherInput && featherVal) {
        featherInput.addEventListener('input', e => {
            const val = parseInt(e.target.value, 10) || 0;

            featherVal.textContent = `${val}px`;
            SelectionEditor.featherRadius = val;

            if (typeof requestSelectionOverlayRender === 'function') {
                requestSelectionOverlayRender();
            }
        });
    }

    if (wandToleranceInput && wandToleranceVal) {
        wandToleranceInput.addEventListener('input', e => {
            const val = parseInt(e.target.value, 10) || 32;

            wandToleranceVal.textContent = val;
            SelectionEditor.wandTolerance = val;
        });
    }

    if (brushSizeInput && brushSizeVal) {
        brushSizeInput.addEventListener('input', e => {
            const val = parseInt(e.target.value, 10) || 20;

            brushSizeVal.textContent = `${val}px`;
            SelectionEditor.brushRadius = val;
        });
    }

    function getCanvasCoords(e) {
        const rect = mainCanvas.getBoundingClientRect();

        const clientX =
            e.touches && e.touches.length > 0
                ? e.touches[0].clientX
                : e.clientX;

        const clientY =
            e.touches && e.touches.length > 0
                ? e.touches[0].clientY
                : e.clientY;

        const scaleX = mainCanvas.width / rect.width;
        const scaleY = mainCanvas.height / rect.height;

        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    function handlePointerDown(e) {
        if (!SelectionEditor.isOpen) return;

        const coords = getCanvasCoords(e);

        SelectionEditor.isDrawing = true;
        SelectionEditor.startCoords = coords;
        SelectionEditor.currentCoords = coords;

        if (
            SelectionEditor.activeMode === 'lasso' ||
            SelectionEditor.activeMode === 'brush'
        ) {
            SelectionEditor.lassoPoints = [coords];
        } else if (SelectionEditor.activeMode === 'polygonal') {
            SelectionEditor.polyPoints.push(coords);
        } else if (
            SelectionEditor.activeMode === 'wand' ||
            SelectionEditor.activeMode === 'eyedropper'
        ) {
            if (typeof processColorSelection === 'function') {
                processColorSelection(
                    coords.x,
                    coords.y,
                    SelectionEditor.wandTolerance,
                    SelectionEditor.activeMode === 'eyedropper'
                );
            }

            SelectionEditor.startCoords = coords;
            SelectionEditor.currentCoords = {
                x: coords.x + 1,
                y: coords.y + 1
            };

            SelectionEditor.isDrawing = false;

            if (typeof requestSelectionOverlayRender === 'function') {
                requestSelectionOverlayRender();
            }

            return;
        }

        if (typeof requestSelectionOverlayRender === 'function') {
            requestSelectionOverlayRender();
        }
    }

    function handlePointerMove(e) {
        if (!SelectionEditor.isOpen || !SelectionEditor.isDrawing) return;

        const coords = getCanvasCoords(e);

        SelectionEditor.currentCoords = coords;

        if (
            SelectionEditor.activeMode === 'lasso' ||
            SelectionEditor.activeMode === 'brush'
        ) {
            SelectionEditor.lassoPoints.push(coords);
        }

        if (typeof requestSelectionOverlayRender === 'function') {
            requestSelectionOverlayRender();
        }
    }

    function handlePointerUp() {
        if (!SelectionEditor.isOpen || !SelectionEditor.isDrawing) return;

        SelectionEditor.isDrawing = false;

        if (
            SelectionEditor.activeMode === 'lasso' &&
            SelectionEditor.lassoPoints.length > 2
        ) {
            SelectionEditor.lassoPoints.push({
                ...SelectionEditor.lassoPoints[0]
            });
        }

        if (typeof finalizeSelectionArea === 'function') {
            finalizeSelectionArea();
        }
    }

    mainCanvas.addEventListener('mousedown', handlePointerDown);
    mainCanvas.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    mainCanvas.addEventListener('touchstart', handlePointerDown, {
        passive: true
    });

    mainCanvas.addEventListener('touchmove', handlePointerMove, {
        passive: true
    });

    window.addEventListener('touchend', handlePointerUp);

    mainCanvas.addEventListener('dblclick', () => {
        if (
            SelectionEditor.activeMode === 'polygonal' &&
            SelectionEditor.polyPoints.length > 2
        ) {
            SelectionEditor.polyPoints.push({
                ...SelectionEditor.polyPoints[0]
            });

            if (typeof finalizeSelectionArea === 'function') {
                finalizeSelectionArea();
            }
        }
    });
});
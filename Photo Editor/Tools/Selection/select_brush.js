// select_brush.js - Freehand Paint Mask Selection Engine
(function() {
    function onMouseDown(e) {
        if (window.imgState?.selection?.mode !== 'brush') return;

        const canvas = document.getElementById('editorCanvas');
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const pt = { 
            x: e.clientX - rect.left, 
            y: e.clientY - rect.top,
            radius: window.imgState.selection.brushSize || 20 
        };

        window.SelectionManager.isSelecting = true;
        if (!window.imgState.selection.path) window.imgState.selection.path = [];
        window.imgState.selection.path.push(pt);
        window.imgState.selection.active = true;
    }

    function onMouseMove(e) {
        if (!window.SelectionManager?.isSelecting || window.imgState?.selection?.mode !== 'brush') return;

        const canvas = document.getElementById('editorCanvas');
        const rect = canvas.getBoundingClientRect();
        const pt = { 
            x: e.clientX - rect.left, 
            y: e.clientY - rect.top,
            radius: window.imgState.selection.brushSize || 20 
        };

        window.imgState.selection.path.push(pt);

        if (window.CanvasEditor && typeof window.CanvasEditor.redraw === 'function') {
            window.CanvasEditor.redraw();
        }
    }

    function onMouseUp() {
        if (window.imgState?.selection?.mode === 'brush' && window.SelectionManager.isSelecting) {
            window.SelectionManager.isSelecting = false;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const canvas = document.getElementById('editorCanvas');
        if (canvas) {
            canvas.addEventListener('mousedown', onMouseDown);
            canvas.addEventListener('mousemove', onMouseMove);
            canvas.addEventListener('mouseup', onMouseUp);
        }
    });
})();
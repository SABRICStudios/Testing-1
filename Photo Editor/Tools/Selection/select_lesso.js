// select_lasso.js - Freehand Draw Selection Engine
(function() {
    function onMouseDown(e) {
        if (window.imgState?.selection?.mode !== 'lasso') return;

        const canvas = document.getElementById('editorCanvas');
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        window.SelectionManager.isSelecting = true;
        window.imgState.selection.path = [pt];
        window.imgState.selection.active = true;
    }

    function onMouseMove(e) {
        if (!window.SelectionManager?.isSelecting || window.imgState?.selection?.mode !== 'lasso') return;

        const canvas = document.getElementById('editorCanvas');
        const rect = canvas.getBoundingClientRect();
        const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        window.imgState.selection.path.push(pt);

        if (window.CanvasEditor && typeof window.CanvasEditor.redraw === 'function') {
            window.CanvasEditor.redraw();
        }
    }

    function onMouseUp() {
        if (window.imgState?.selection?.mode === 'lasso' && window.SelectionManager.isSelecting) {
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
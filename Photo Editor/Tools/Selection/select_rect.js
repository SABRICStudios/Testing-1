// select_rect.js - Rectangular Region Selection Engine
(function() {
    let startX = 0, startY = 0;

    function onMouseDown(e) {
        if (window.imgState?.selection?.mode !== 'rect') return;
        
        const canvas = document.getElementById('editorCanvas');
        if (!canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;

        window.SelectionManager.isSelecting = true;
        window.imgState.selection.bounds = { x: startX, y: startY, width: 0, height: 0 };
    }

    function onMouseMove(e) {
        if (!window.SelectionManager?.isSelecting || window.imgState?.selection?.mode !== 'rect') return;
        
        const canvas = document.getElementById('editorCanvas');
        const rect = canvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const width = currentX - startX;
        const height = currentY - startY;

        window.imgState.selection.bounds = {
            x: width < 0 ? currentX : startX,
            y: height < 0 ? currentY : startY,
            width: Math.abs(width),
            height: Math.abs(height)
        };
        window.imgState.selection.active = true;

        if (window.CanvasEditor && typeof window.CanvasEditor.redraw === 'function') {
            window.CanvasEditor.redraw();
        }
    }

    function onMouseUp() {
        if (window.imgState?.selection?.mode === 'rect' && window.SelectionManager.isSelecting) {
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
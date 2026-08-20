// select_poly_lasso.js - Point-to-Point Polygon Selection Engine
(function() {
    function onClick(e) {
        if (window.imgState?.selection?.mode !== 'poly') return;

        const canvas = document.getElementById('editorCanvas');
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top };

        if (!window.imgState.selection.path) {
            window.imgState.selection.path = [];
        }

        window.imgState.selection.path.push(pt);
        window.imgState.selection.active = true;

        if (window.CanvasEditor && typeof window.CanvasEditor.redraw === 'function') {
            window.CanvasEditor.redraw();
        }
    }

    function onDblClick() {
        if (window.imgState?.selection?.mode !== 'poly') return;
        // Close polygon on double click
        if (window.imgState.selection.path.length > 2) {
            window.imgState.selection.path.push(window.imgState.selection.path[0]);
        }
        if (window.CanvasEditor && typeof window.CanvasEditor.redraw === 'function') {
            window.CanvasEditor.redraw();
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const canvas = document.getElementById('editorCanvas');
        if (canvas) {
            canvas.addEventListener('click', onClick);
            canvas.addEventListener('dblclick', onDblClick);
        }
    });
})();
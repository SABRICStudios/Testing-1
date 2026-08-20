// select_color.js - Target Color & Chromatic Range Selection
(function() {
    function onCanvasClick(e) {
        if (window.imgState?.selection?.mode !== 'color') return;

        const canvas = document.getElementById('editorCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const x = Math.round(e.clientX - rect.left);
        const y = Math.round(e.clientY - rect.top);

        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const targetColor = { r: pixel[0], g: pixel[1], b: pixel[2] };

        window.imgState.selection.targetColor = targetColor;
        window.imgState.selection.active = true;

        console.log(`Selected Color Target: R:${targetColor.r} G:${targetColor.g} B:${targetColor.b}`);

        if (window.CanvasEditor && typeof window.CanvasEditor.redraw === 'function') {
            window.CanvasEditor.redraw();
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const colorBtn = document.getElementById('colorSelectBtn');
        if (colorBtn) {
            colorBtn.addEventListener('click', () => {
                if (window.SelectionManager) {
                    window.SelectionManager.setMode('color');
                }
            });
        }

        const canvas = document.getElementById('editorCanvas');
        if (canvas) {
            canvas.addEventListener('click', onCanvasClick);
        }
    });
})();
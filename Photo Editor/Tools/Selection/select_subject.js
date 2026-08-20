// select_subject.js - Automated Subject Detection & Selection
(function() {
    function runSubjectDetection() {
        console.log("Running Subject Detection algorithm...");
        
        const canvas = document.getElementById('editorCanvas');
        if (!canvas) return;

        // Auto-detect bounding region / mask hook
        window.imgState.selection.mode = 'subject';
        window.imgState.selection.active = true;
        
        // Example fallback: default central subject box until model inference runs
        const width = canvas.width * 0.6;
        const height = canvas.height * 0.7;
        window.imgState.selection.bounds = {
            x: (canvas.width - width) / 2,
            y: (canvas.height - height) / 2,
            width: width,
            height: height
        };

        if (window.CanvasEditor && typeof window.CanvasEditor.redraw === 'function') {
            window.CanvasEditor.redraw();
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const subjectBtn = document.getElementById('selectSubjectBtn');
        if (subjectBtn) {
            subjectBtn.addEventListener('click', () => {
                if (window.SelectionManager) {
                    window.SelectionManager.setMode('subject');
                }
                runSubjectDetection();
            });
        }
    });
})();
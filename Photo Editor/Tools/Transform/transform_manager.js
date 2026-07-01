/**
 * Visuals Photo Editor - Transform Tool UI Controller (transform_manager.js)
 * Handles toggling panels, sub-modes, form synchronization, and layout adjustments.
 * Optimized for flawless performance and layouts across Mobile + PC.
 */

document.addEventListener("DOMContentLoaded", () => {
    // --- Elements Selector Setup ---\
    const transformBtn = document.getElementById("transformBtn");
    const transformPanel = document.getElementById("transformPanel");
    
    const resizeToolBtn = document.getElementById("resizeToolBtn");
    const rotateToolBtn = document.getElementById("rotateToolBtn");
    
    const resizeInputControl = document.getElementById("resizeInputControl");
    const rotateInputControl = document.getElementById("rotateInputControl");
    
    // Action Controls
    const confirmResizeBtn = document.getElementById("confirmResizeBtn");
    const discardResizeBtn = document.getElementById("discardResizeBtn");
    const confirmRotateBtn = document.getElementById("confirmRotateBtn");
    const discardRotateBtn = document.getElementById("discardRotateBtn");

    // Value Inputs & Interactive Sliders
    const transformWidthInput = document.getElementById("transformWidthInput");
    const transformHeightInput = document.getElementById("transformHeightInput");
    const transformRotateInput = document.getElementById("transformRotateInput");
    const transformRotationSlider = document.getElementById("transformRotationSlider");

    // Deep memory container checkpoint for discarding operations safely
    let originalTransformState = { width: 0, height: 0, rotation: 0 };

    function captureCurrentState() {
        if (window.HistoryManager) {
            const currentSnapshot = window.HistoryManager.getCurrentParameters();
            const transform = currentSnapshot.transform || {};
            originalTransformState = {
                width: transform.width || (window.imgState.img ? window.imgState.img.width : 0),
                height: transform.height || (window.imgState.img ? window.imgState.img.height : 0),
                rotation: transform.rotation || 0
            };
        }
    }

    function closeAllTransformSubPanels() {
        if (resizeInputControl) resizeInputControl.style.display = "none";
        if (rotateInputControl) rotateInputControl.style.display = "none";
        if (resizeToolBtn) resizeToolBtn.classList.remove("active");
        if (rotateToolBtn) rotateToolBtn.classList.remove("active");
    }

    if (transformBtn) {
        transformBtn.addEventListener("click", () => {
            if (transformPanel) {
                const isHidden = transformPanel.style.display === "none" || !transformPanel.style.display;
                transformPanel.style.display = isHidden ? "flex" : "none";
                if (isHidden) {
                    captureCurrentState();
                    if (window.TransformToolControllerInstance) {
                        window.TransformToolControllerInstance.syncFieldsWithHistory();
                    }
                }
            }
        });
    }

    if (resizeToolBtn) {
        resizeToolBtn.addEventListener("click", () => {
            closeAllTransformSubPanels();
            captureCurrentState();
            if (resizeInputControl) resizeInputControl.style.display = "flex";
            resizeToolBtn.classList.add("active");
        });
    }

    if (rotateToolBtn) {
        rotateToolBtn.addEventListener("click", () => {
            closeAllTransformSubPanels();
            captureCurrentState();
            if (rotateInputControl) rotateInputControl.style.display = "flex";
            rotateToolBtn.classList.add("active");
        });
    }

    // --- Action Button Implementations ---
    if (confirmResizeBtn) {
        confirmResizeBtn.addEventListener("click", () => {
            const targetW = parseInt(transformWidthInput.value, 10);
            const targetH = parseInt(transformHeightInput.value, 10);

            if (window.HistoryManager) {
                const liveState = window.HistoryManager.getCurrentParameters();
                if (!liveState.transform) liveState.transform = {};
                liveState.transform.width = targetW;
                liveState.transform.height = targetH;
            }

            if (window.TransformToolControllerInstance && typeof window.TransformToolControllerInstance.commitTransformState === "function") {
                window.TransformToolControllerInstance.commitTransformState("Resize Operations Applied");
            }

            captureCurrentState();
            closeAllTransformSubPanels();
        });
    }

    if (discardResizeBtn) {
        discardResizeBtn.addEventListener("click", () => {
            if (transformWidthInput) transformWidthInput.value = originalTransformState.width;
            if (transformHeightInput) transformHeightInput.value = originalTransformState.height;

            if (window.TransformToolControllerInstance && typeof window.TransformToolControllerInstance.liveRenderTransformationPreview === "function") {
                window.TransformToolControllerInstance.liveRenderTransformationPreview(
                    originalTransformState.width,
                    originalTransformState.height,
                    originalTransformState.rotation
                );
            }

            closeAllTransformSubPanels();
            window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
        });
    }

    if (confirmRotateBtn) {
        confirmRotateBtn.addEventListener("click", () => {
            const degrees = parseFloat(transformRotationSlider ? transformRotationSlider.value : transformRotateInput.value) || 0;
            const targetW = parseInt(transformWidthInput.value, 10) || (window.imgState.img ? window.imgState.img.width : 0);
            const targetH = parseInt(transformHeightInput.value, 10) || (window.imgState.img ? window.imgState.img.height : 0);

            if (window.HistoryManager) {
                const liveState = window.HistoryManager.getCurrentParameters();
                if (!liveState.transform) liveState.transform = {};
                liveState.transform.width = targetW;
                liveState.transform.height = targetH;
                liveState.transform.rotation = degrees;
            }

            if (window.TransformToolControllerInstance && typeof window.TransformToolControllerInstance.commitTransformState === "function") {
                window.TransformToolControllerInstance.commitTransformState("Rotation Operations Applied");
            }

            captureCurrentState();
            closeAllTransformSubPanels();
        });
    }

    if (discardRotateBtn) {
        discardRotateBtn.addEventListener("click", () => {
            if (transformRotateInput) transformRotateInput.value = originalTransformState.rotation;
            if (transformRotationSlider) transformRotationSlider.value = originalTransformState.rotation;
            
            if (window.TransformToolControllerInstance && typeof window.TransformToolControllerInstance.liveRenderTransformationPreview === "function") {
                window.TransformToolControllerInstance.liveRenderTransformationPreview(
                    originalTransformState.width,
                    originalTransformState.height,
                    originalTransformState.rotation
                );
            }
            
            closeAllTransformSubPanels();
            window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
        });
    }
    
    // Listen for global history undos/redos to ensure input boxes adapt instantly
    window.addEventListener("editorHistoryChanged", () => {
        if (window.TransformToolControllerInstance) {
            window.TransformToolControllerInstance.syncFieldsWithHistory();
        }
    });
});
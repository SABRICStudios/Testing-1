// transform.js - Clean-Room Matrix Transformation Controller Engine
class TransformToolController {
    constructor() {
        this.widthInput = document.getElementById("transformWidthInput");
        this.heightInput = document.getElementById("transformHeightInput");
        this.rotationSlider = document.getElementById("transformRotationSlider") || document.getElementById("rotationInput");
        this.rotationNumberInput = document.getElementById("transformRotateInput");
        this.aspectRatioLockCheckbox = document.getElementById("lockAspectRatioCheckbox");
        
        this.currentAspectRatio = 1.0;
        this.ticking = false; 
        
        this.initListeners();
    }

    initListeners() {
        if (this.widthInput) {
            this.widthInput.addEventListener("input", (e) => this.handleDimensionChange(e, 'width'));
            this.widthInput.addEventListener("change", () => this.commitTransformState("Resize Width"));
        }
        if (this.heightInput) {
            this.heightInput.addEventListener("input", (e) => this.handleDimensionChange(e, 'height'));
            this.heightInput.addEventListener("change", () => this.commitTransformState("Resize Height"));
        }

        if (this.rotationSlider) {
            this.rotationSlider.addEventListener("input", (e) => {
                const targetDeg = parseFloat(e.target.value) || 0;
                this.requestAnimationFrameRender(targetDeg);
            });
            this.rotationSlider.addEventListener("change", () => {
                this.commitTransformState("Rotate Image");
            });
            this.rotationSlider.addEventListener("touchend", () => {
                setTimeout(() => {
                    this.commitTransformState("Rotate Image");
                }, 50);
            });
        }

        if (this.rotationNumberInput) {
            this.rotationNumberInput.addEventListener("input", (e) => {
                const targetDeg = parseFloat(e.target.value) || 0;
                if (this.rotationSlider) this.rotationSlider.value = targetDeg;
                this.requestAnimationFrameRender(targetDeg);
            });
            this.rotationNumberInput.addEventListener("change", () => {
                this.commitTransformState("Rotate Image");
            });
        }
    }

    requestAnimationFrameRender(degrees) {
        if (!this.ticking) {
            window.requestAnimationFrame(() => {
                this.handleRotationLivePreview(degrees);
                this.ticking = false;
            });
            this.ticking = true;
        }
    }

    handleDimensionChange(e, modifiedField) {
        let val = parseInt(e.target.value, 10) || 0;
        if (val <= 0) return;

        // Safety check floor limit
        if (val < 25) val = 25; 

        if (!this.currentAspectRatio && this.widthInput && this.heightInput) {
            const w = parseInt(this.widthInput.value, 10) || 1;
            const h = parseInt(this.heightInput.value, 10) || 1;
            this.currentAspectRatio = w / h;
        }

        const lockRatio = this.aspectRatioLockCheckbox 
            ? this.aspectRatioLockCheckbox.checked 
            : (window.imgState ? window.imgState.maintainAspectRatio : false);

        if (lockRatio && this.currentAspectRatio) {
            if (modifiedField === 'width' && this.heightInput) {
                this.heightInput.value = Math.round(val / this.currentAspectRatio);
            } else if (modifiedField === 'height' && this.widthInput) {
                this.widthInput.value = Math.round(val * this.currentAspectRatio);
            }
        }
        
        const targetW = parseInt(this.widthInput?.value, 10) || window.imgState?.width || 1;
        const targetH = parseInt(this.heightInput?.value, 10) || window.imgState?.height || 1;
        const targetR = parseFloat(this.rotationSlider?.value) || window.imgState?.rotation || 0;

        // Explicitly trigger single preview render pass
        this.liveRenderTransformationPreview(targetW, targetH, targetR);
    }

    handleRotationLivePreview(degrees) {
        if (this.rotationNumberInput) {
            this.rotationNumberInput.value = Math.round(degrees);
        }
        const w = parseInt(this.widthInput?.value, 10) || window.imgState?.width || 0;
        const h = parseInt(this.heightInput?.value, 10) || window.imgState?.height || 0;
        this.liveRenderTransformationPreview(w, h, degrees);
    }

    liveRenderTransformationPreview(width, height, rotation) {
        if (!window.imgState) return;
        window.imgState.width = parseInt(width, 10);
        window.imgState.height = parseInt(height, 10);
        window.imgState.rotation = parseFloat(rotation);
        
        if (window.CanvasEditor && typeof window.CanvasEditor.applyEffectsPipeline === "function") {
            window.CanvasEditor.applyEffectsPipeline();
        } else if (typeof window.renderCanvasStack === "function") {
            window.renderCanvasStack();
        }
    }

    commitTransformState(label) {
        if (!window.imgState) return;

        const targetW = parseInt(this.widthInput?.value, 10) || window.imgState.width;
        const targetH = parseInt(this.heightInput?.value, 10) || window.imgState.height;
        const targetR = parseFloat(this.rotationSlider?.value) || window.imgState.rotation || 0;

        window.imgState.width = targetW;
        window.imgState.height = targetH;
        window.imgState.rotation = targetR;

        if (window.HistoryManager && typeof window.HistoryManager.commitChange === "function") {
            window.HistoryManager.commitChange(label, {
                type: 'transform',
                values: { width: targetW, height: targetH, rotation: targetR }
            });
        } else {
            window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
        }
    }

    syncFieldsWithHistory() {
        if (!window.imgState) return;

        let currentW = window.imgState.width;
        let currentH = window.imgState.height;
        let currentR = window.imgState.rotation || 0;

        if (window.HistoryManager && typeof window.HistoryManager.getCurrentParameters === "function") {
            const configMatrix = window.HistoryManager.getCurrentParameters();
            const transformState = configMatrix.transform || {};
            if (transformState.width) currentW = transformState.width;
            if (transformState.height) currentH = transformState.height;
            if (transformState.rotation !== undefined) currentR = transformState.rotation;
        }

        // Fallbacks if width or height are undefined
        let fallbackW = window.imgState.img?.naturalWidth || window.imgState.img?.width || 800;
        let fallbackH = window.imgState.img?.naturalHeight || window.imgState.img?.height || 600;

        currentW = currentW || fallbackW;
        currentH = currentH || fallbackH;

        if (this.widthInput) this.widthInput.value = currentW;
        if (this.heightInput) this.heightInput.value = currentH;
        if (this.rotationSlider) this.rotationSlider.value = currentR;
        if (this.rotationNumberInput) this.rotationNumberInput.value = Math.round(currentR);

        this.currentAspectRatio = (currentW / currentH) || 1.0;
        
        window.imgState.width = currentW;
        window.imgState.height = currentH;
        window.imgState.rotation = currentR;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.TransformToolControllerInstance = new TransformToolController();
});
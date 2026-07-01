// transform.js - Clean-Room Matrix Transformation Controller Engine
// Optimized for seamless, high-performance interactions on Mobile Touch & PC.

class TransformToolController {
    constructor() {
        // Core Input Elements
        this.widthInput = document.getElementById("transformWidthInput");
        this.heightInput = document.getElementById("transformHeightInput");
        this.rotationSlider = document.getElementById("transformRotationSlider") || document.getElementById("rotationInput");
        this.rotationNumberInput = document.getElementById("transformRotateInput");
        this.aspectRatioLockCheckbox = document.getElementById("lockAspectRatioCheckbox");
        
        // Internal State Constants
        this.currentAspectRatio = 1.0;
        this.ticking = false; 
        
        this.initListeners();
    }

    /**
     * Set up robust action bindings supporting both desktop input 
     * tracking and mobile touch environments.
     */
    initListeners() {
        // --- Width/Height Dimensions Inputs ---
        if (this.widthInput) {
            this.widthInput.addEventListener("input", (e) => this.handleDimensionChange(e, 'width'));
            this.widthInput.addEventListener("change", () => this.commitTransformState("Resize Width"));
        }
        if (this.heightInput) {
            this.heightInput.addEventListener("input", (e) => this.handleDimensionChange(e, 'height'));
            this.heightInput.addEventListener("change", () => this.commitTransformState("Resize Height"));
        }

        // --- Rotation Slider Input (Handles mobile touch drag updates) ---
        if (this.rotationSlider) {
            // Fires continuously while scrubbing on PC and Mobile
            this.rotationSlider.addEventListener("input", (e) => {
                const targetDeg = parseFloat(e.target.value) || 0;
                this.requestAnimationFrameRender(targetDeg);
            });

            // Fires explicitly when the user lifts their finger/mouse
            this.rotationSlider.addEventListener("change", () => {
                this.commitTransformState("Rotate Image");
            });

            // Mobile safety safeguard: guarantees final save on touch lift
            this.rotationSlider.addEventListener("touchend", () => {
                // Short delay to ensure input values settle before committing state
                setTimeout(() => {
                    this.commitTransformState("Rotate Image");
                }, 50);
            });
        }

        // --- Optional Numeric Box Input for Rotation ---
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

    /**
     * Throttles live updates via RequestAnimationFrame to protect mobile main thread performance
     */
    requestAnimationFrameRender(degrees) {
        if (!this.ticking) {
            window.requestAnimationFrame(() => {
                this.handleRotationLivePreview(degrees);
                this.ticking = false;
            });
            this.ticking = true;
        }
    }

    /**
     * Manages Aspect Ratio constraints and matches dimensions across bounding pairs
     */
    handleDimensionChange(e, modifiedField) {
        const val = parseInt(e.target.value, 10) || 0;
        if (val <= 0) return;

        // Auto-calculate structural aspect ratios if missing
        if (!this.currentAspectRatio && this.widthInput && this.heightInput) {
            const w = parseInt(this.widthInput.value, 10) || 1;
            const h = parseInt(this.heightInput.value, 10) || 1;
            this.currentAspectRatio = w / h;
        }

        const lockRatio = this.aspectRatioLockCheckbox ? this.aspectRatioLockCheckbox.checked : true;

        if (lockRatio && this.currentAspectRatio) {
            if (modifiedField === 'width' && this.heightInput) {
                this.heightInput.value = Math.round(val / this.currentAspectRatio);
            } else if (modifiedField === 'height' && this.widthInput) {
                this.widthInput.value = Math.round(val * this.currentAspectRatio);
            }
        }
        
        this.liveRenderTransformationPreview(
            parseInt(this.widthInput?.value, 10) || window.imgState?.img?.width || 0,
            parseInt(this.heightInput?.value, 10) || window.imgState?.img?.height || 0,
            parseFloat(this.rotationSlider?.value) || 0
        );
    }

    /**
     * Updates companion inputs and synchronizes live values to preview render blocks
     */
    handleRotationLivePreview(degrees) {
        if (this.rotationNumberInput) {
            this.rotationNumberInput.value = Math.round(degrees);
        }

        const w = parseInt(this.widthInput?.value, 10) || window.imgState?.img?.width || 0;
        const h = parseInt(this.heightInput?.value, 10) || window.imgState?.img?.height || 0;
        
        this.liveRenderTransformationPreview(w, h, degrees);
    }

    /**
     * Feeds the state adjustments directly into the shared global canvas state registers
     */
    liveRenderTransformationPreview(width, height, rotation) {
        if (!window.imgState) return;

        // Persist states globally so processing hooks don't lose baseline states
        window.imgState.width = parseInt(width, 10);
        window.imgState.height = parseInt(height, 10);
        window.imgState.rotation = parseFloat(rotation);
        
        // Force rendering pipeline execution block
        if (window.CanvasEditor && typeof window.CanvasEditor.applyEffectsPipeline === "function") {
            window.CanvasEditor.applyEffectsPipeline();
        }
    }

    /**
     * Flushes local UI transform parameters down into the Master History Timeline manager
     */
    commitTransformState(label) {
        if (!window.HistoryManager || !window.imgState) return;

        const targetW = parseInt(this.widthInput?.value, 10) || window.imgState.width || window.imgState.img?.width;
        const targetH = parseInt(this.heightInput?.value, 10) || window.imgState.height || window.imgState.img?.height;
        const targetR = parseFloat(this.rotationSlider?.value) || window.imgState.rotation || 0;

        // Inject data back down into global state tracking caches to lock values
        window.imgState.width = targetW;
        window.imgState.height = targetH;
        window.imgState.rotation = targetR;

        // FIXED: Replaced legacy non-existent "pushState" reference with master history "commitChange" function
        if (typeof window.HistoryManager.commitChange === "function") {
            window.HistoryManager.commitChange(label, {
                type: 'transform',
                values: {
                    width: targetW,
                    height: targetH,
                    rotation: targetR
                }
            });
        } else {
            // Fallback alert hook if system encounters a timing collision
            window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
        }
    }

    /**
     * Synchronizes form elements to baseline values whenever an undo/redo action triggers
     */
    syncFieldsWithHistory() {
        if (!window.HistoryManager || !window.imgState || !window.imgState.img) return;

        const configMatrix = window.HistoryManager.getCurrentParameters();
        const transformState = configMatrix.transform || {};

        const fallbackW = window.imgState.img.width;
        const fallbackH = window.imgState.img.height;

        // Pull saved data, fallback securely to original source image attributes if empty
        const currentW = transformState.width || fallbackW;
        const currentH = transformState.height || fallbackH;
        const currentR = transformState.rotation !== undefined ? transformState.rotation : 0;

        // Synchronize display inputs
        if (this.widthInput) this.widthInput.value = currentW;
        if (this.heightInput) this.heightInput.value = currentH;
        if (this.rotationSlider) this.rotationSlider.value = currentR;
        if (this.rotationNumberInput) this.rotationNumberInput.value = Math.round(currentR);

        // Adjust tracking ratios
        this.currentAspectRatio = (currentW / currentH) || 1.0;
        
        // Re-inject variables into structural states
        window.imgState.width = currentW;
        window.imgState.height = currentH;
        window.imgState.rotation = currentR;
    }
}

// Instantiate and initialize on DOM ready state profiles
document.addEventListener("DOMContentLoaded", () => {
    window.TransformToolControllerInstance = new TransformToolController();
});
// Tools/Blur/blur_manager.js

const BlurManager = {
    screenCanvas: null,
    screenCtx: null,
    toolBufferCanvas: null,  
    originalImageData: null, 

    init() {
        this.screenCanvas = document.getElementById('editorCanvas');
        if (!this.screenCanvas) return;
        this.screenCtx = this.screenCanvas.getContext('2d', { willReadFrequently: true }); 

        this.initDOM();
        this.initEvents();
    },

    initDOM() {
        // Targets your specific button ID and the cleaned panel ID
        this.blurBtn = document.getElementById('blurBtn');
        this.blurPanel = document.getElementById('blurPanel');
        this.gaussianSlider = document.getElementById('gaussianSlider');
        this.radialSlider = document.getElementById('radialSlider');
        this.confirmGaussian = document.getElementById('confirmGaussianBlurBtn');
        this.discardGaussian = document.getElementById('discardGaussianBlurBtn');
    },

initEvents() {
        if (this.blurBtn) {
            this.blurBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleBlurPanel();
            });
        }

        // Shared slider handler that works on mobile touch
        const handleSliderChange = (e) => {
            const key = e.target.id === 'gaussianSlider' ? 'gaussian' : 'radial';
            if (window.HistoryManager && typeof window.HistoryManager.updateValue === 'function') {
                window.HistoryManager.updateValue(key, e.target.value);
            }
            this.processLiveBlur();
        };

        if (this.gaussianSlider) {
            this.gaussianSlider.addEventListener('input', handleSliderChange);
        }

        if (this.radialSlider) {
            this.radialSlider.addEventListener('input', handleSliderChange);
        }

        if (this.confirmGaussian) {
            this.confirmGaussian.addEventListener('click', () => this.handleConfirm());
        }
        
        if (this.discardGaussian) {
            this.discardGaussian.addEventListener('click', () => this.handleDiscard());
        }
    },

toggleBlurPanel() {
        if (!this.blurPanel) {
            console.error("Blur panel element missing from the DOM.");
            return;
        }

        // Directly read what is written in the style attribute
        const currentDisplay = this.blurPanel.style.display.trim().toLowerCase();

        // If it contains 'none' or is empty, force it open
        if (currentDisplay === 'none' || currentDisplay === '') {
            
            // Close competing panels safely if they exist
            const competingPanels = ['adjustPanel', 'transformPanel', 'filterPanel', 'curvesPanel', 'gradingPanel'];
            competingPanels.forEach(id => {
                const panel = document.getElementById(id);
                if (panel) panel.style.display = 'none';
            });

            // Make it block instantly
            this.blurPanel.style.display = 'block';
            if (this.blurBtn) this.blurBtn.classList.add('active');

            // Fire canvas operations safely without blocking the UI if they error out
            try {
                this.startBlurSession();
            } catch (e) {
                console.warn("Canvas session skipped, but panel is open:", e);
            }

        } else {
            // If it's already 'block', close it
            this.exitBlurPanel();
        }
    },

startBlurSession() {
        let workingSource = null;
        if (window.CanvasEditor && typeof window.CanvasEditor.getWorkingImage === 'function') {
            workingSource = window.CanvasEditor.getWorkingImage();
        }
        if (!workingSource || !workingSource.width) {
            workingSource = window.imgState ? window.imgState.img : null;
        }
        
        if (!workingSource) return;

        if (this.gaussianSlider) this.gaussianSlider.value = 0;
        if (this.radialSlider) this.radialSlider.value = 0;

        // FIXED: Downsample the offscreen working canvas for real-time manipulation on Android
        const MAX_SCRUB_DIM = 800; // Small, ultra-fast proxy size
        let scale = 1;
        if (workingSource.width > MAX_SCRUB_DIM || workingSource.height > MAX_SCRUB_DIM) {
            scale = MAX_SCRUB_DIM / Math.max(workingSource.width, workingSource.height);
        }

        this.toolBufferCanvas = document.createElement('canvas');
        this.toolBufferCanvas.width = Math.round(workingSource.width * scale);
        this.toolBufferCanvas.height = Math.round(workingSource.height * scale);

        const bufferCtx = this.toolBufferCanvas.getContext('2d', { willReadFrequently: true });
        bufferCtx.drawImage(workingSource, 0, 0, this.toolBufferCanvas.width, this.toolBufferCanvas.height);

        // This smaller data makes sliding incredibly fluid!
        this.originalImageData = bufferCtx.getImageData(0, 0, this.toolBufferCanvas.width, this.toolBufferCanvas.height);
    },

    processLiveBlur() {
        if (!this.originalImageData || !this.toolBufferCanvas) return;

        const bufferCtx = this.toolBufferCanvas.getContext('2d');
        bufferCtx.putImageData(this.originalImageData, 0, 0);

        const radius = this.gaussianSlider ? parseFloat(this.gaussianSlider.value) : 0;
        const intensity = this.radialSlider ? parseInt(this.radialSlider.value, 10) : 0;

        // Run filter passes sequentially using execution pipeline
        if (radius > 0 && typeof BlurFilters !== 'undefined' && BlurFilters.applyGaussian) {
            BlurFilters.applyGaussian(this.originalImageData, this.toolBufferCanvas, radius);
        }
        
        if (intensity > 0 && typeof BlurFilters !== 'undefined' && BlurFilters.applyRadialDepth) {
            const currentData = bufferCtx.getImageData(0, 0, this.toolBufferCanvas.width, this.toolBufferCanvas.height);
            BlurFilters.applyRadialDepth(currentData, this.toolBufferCanvas, intensity);
        }

        this.renderPreviewToViewport();
    },

    renderPreviewToViewport() {
        if (!this.toolBufferCanvas) return;
        
        const state = window.imgState || (window.CanvasEditor ? window.CanvasEditor.getState() : { x: 0, y: 0, width: this.screenCanvas.width, height: this.screenCanvas.height });

        this.screenCtx.clearRect(0, 0, this.screenCanvas.width, this.screenCanvas.height);
        this.screenCtx.drawImage(this.toolBufferCanvas, state.x, state.y, state.width, state.height);

        if (state.isSelected) {
            this.screenCtx.strokeStyle = '#00adb5';
            this.screenCtx.lineWidth = 2;
            this.screenCtx.strokeRect(state.x, state.y, state.width, state.height);
        }
    },

handleConfirm() {
        const radius = this.gaussianSlider ? parseFloat(this.gaussianSlider.value) : 0;
        const intensity = this.radialSlider ? parseInt(this.radialSlider.value, 10) : 0;

        // Commit the parameters directly into your application's History Engine
        if (window.HistoryManager && typeof window.HistoryManager.commitChange === 'function') {
            window.HistoryManager.commitChange("Gaussian Blur", {
                type: 'blur',
                values: {
                    gaussian: radius,
                    radial: intensity
                }
            });
        } else {
            // Fallback: If HistoryManager isn't tracking yet, trigger the effects pipeline manually
            if (window.CanvasEditor && typeof window.CanvasEditor.applyEffectsPipeline === 'function') {
                window.CanvasEditor.applyEffectsPipeline();
            }
        }

        this.exitBlurPanel();
    },

    handleDiscard() {
        this.exitBlurPanel();
    },

    exitBlurPanel() {
        if (this.blurPanel) this.blurPanel.style.display = 'none';
        if (this.blurBtn) this.blurBtn.classList.remove('active');
        
        this.toolBufferCanvas = null;
        this.originalImageData = null;

        if (window.CanvasEditor && typeof window.CanvasEditor.redraw === 'function') {
            window.CanvasEditor.redraw();
        }
    }
};

// Auto-run once application DOM configuration locks in
document.addEventListener('DOMContentLoaded', () => BlurManager.init());
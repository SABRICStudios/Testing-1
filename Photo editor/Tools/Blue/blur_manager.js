// Tools/Blur/blur_manager.js

const BlurManager = {
    screenCanvas: null,
    screenCtx: null,
    toolBufferCanvas: null,  // High-res preview manipulation array buffer
    originalImageData: null, // Pristine unblurred pixels extracted from original source
    activeSubTool: null,     // Tracks 'gaussian' or 'radial'

    init() {
        this.screenCanvas = document.getElementById('editorCanvas');
        this.screenCtx = this.screenCanvas.getContext('2d');

        this.initDOM();
        this.initEvents();
    },

    initDOM() {
        // Core triggers
        this.blurBtn = document.getElementById('blurBtn');
        this.blurPanel = document.getElementById('blurPanel');
        this.blurGallery = document.getElementById('blurGallery');

        // Sub-tool toggle selectors
        this.gaussianToolBtn = document.getElementById('gaussianBlurToolBtn');
        this.radialToolBtn = document.getElementById('radialBlurToolBtn');

        // Controls
        this.gaussianControl = document.getElementById('gaussianSliderControl');
        this.radialControl = document.getElementById('radialSliderControl');
        this.gaussianSlider = document.getElementById('gaussianSlider');
        this.radialSlider = document.getElementById('radialSlider');

        // Action operations
        this.confirmGaussian = document.getElementById('confirmGaussianBlurBtn');
        this.discardGaussian = document.getElementById('discardGaussianBlurBtn');
        this.confirmRadial = document.getElementById('confirmRadialBtn');
        this.discardRadial = document.getElementById('discardRadialBtn');
    },

    initEvents() {
        // Open Master Tool Layout Panel
        if (this.blurBtn) {
            this.blurBtn.addEventListener('click', () => this.openBlurPanel());
        }

        // Sub-tool switching selection buttons
        this.gaussianToolBtn.addEventListener('click', () => this.startSubToolSession('gaussian'));
        this.radialToolBtn.addEventListener('click', () => this.startSubToolSession('radial'));

        // Real-time slider previewing loops
        this.gaussianSlider.addEventListener('input', (e) => {
            const radius = parseFloat(e.target.value);
            this.processLiveBlur('gaussian', radius);
        });

        this.radialSlider.addEventListener('input', (e) => {
            const intensity = parseInt(e.target.value, 10);
            this.processLiveBlur('radial', intensity);
        });

        // User Operation Action toggles
        this.confirmGaussian.addEventListener('click', () => this.handleConfirm());
        this.discardGaussian.addEventListener('click', () => this.handleDiscard());
        this.confirmRadial.addEventListener('click', () => this.handleConfirm());
        this.discardRadial.addEventListener('click', () => this.handleDiscard());
    },

    openBlurPanel() {
        if (this.blurPanel.style.display === 'none') {
            // Close other core panels if visible (similar to global reset layout flows)
            this.blurPanel.style.display = 'block';
            this.blurGallery.style.display = 'flex';
            this.gaussianControl.style.display = 'none';
            this.radialControl.style.display = 'none';
        } else {
            this.exitMasterPanel();
        }
    },

    startSubToolSession(type) {
        if (!window.CanvasEditor) return;
        const workingSource = window.CanvasEditor.getWorkingImage();
        if (!workingSource) return;

        this.activeSubTool = type;
        this.gaussianSlider.value = 0;
        this.radialSlider.value = 0;

        // Create high-resolution editing staging canvas
        this.toolBufferCanvas = document.createElement('canvas');
        this.toolBufferCanvas.width = workingSource.width;
        this.toolBufferCanvas.height = workingSource.height;

        const bufferCtx = this.toolBufferCanvas.getContext('2d');
        bufferCtx.drawImage(workingSource, 0, 0);

        // Extract high-resolution pristine pixel maps
        this.originalImageData = bufferCtx.getImageData(0, 0, workingSource.width, workingSource.height);

        // Update UI drawers
        this.blurGallery.style.display = 'none';
        if (type === 'gaussian') {
            this.gaussianControl.style.display = 'block';
        } else if (type === 'radial') {
            this.radialControl.style.display = 'block';
        }
    },

    processLiveBlur(type, value) {
        if (!this.originalImageData || !this.toolBufferCanvas) return;

        if (type === 'gaussian') {
            BlurFilters.applyGaussian(this.originalImageData, this.toolBufferCanvas, value);
        } else if (type === 'radial') {
            BlurFilters.applyRadialDepth(this.originalImageData, this.toolBufferCanvas, value);
        }

        this.renderPreviewToViewport();
    },

    renderPreviewToViewport() {
        if (!window.CanvasEditor) return;
        const state = window.CanvasEditor.getState();

        this.screenCtx.clearRect(0, 0, this.screenCanvas.width, this.screenCanvas.height);
        this.screenCtx.drawImage(this.toolBufferCanvas, state.x, state.y, state.width, state.height);

        if (state.isSelected) {
            this.screenCtx.strokeStyle = '#00adb5';
            this.screenCtx.lineWidth = 2;
            this.screenCtx.strokeRect(state.x, state.y, state.width, state.height);
        }
    },

    handleConfirm() {
        if (this.toolBufferCanvas) {
            window.CanvasEditor.updateImageXFromCanvas(this.toolBufferCanvas);
        }
        this.exitSubToolSession();
    },

    handleDiscard() {
        this.exitSubToolSession();
    },

    exitSubToolSession() {
        this.toolBufferCanvas = null;
        this.originalImageData = null;
        this.activeSubTool = null;

        this.gaussianControl.style.display = 'none';
        this.radialControl.style.display = 'none';
        this.blurGallery.style.display = 'flex';

        if (window.CanvasEditor) {
            window.CanvasEditor.redraw();
        }
    },

    exitMasterPanel() {
        this.blurPanel.style.display = 'none';
        this.exitSubToolSession();
    }
};

// Auto-initialize on framework ready event
document.addEventListener('DOMContentLoaded', () => BlurManager.init());
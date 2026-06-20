// highlights.js - Isolated High-Resolution Thresholding Tool Linked to History Baseline

const HighlightsTool = {
    toolBufferCanvas: null,  
    originalImageData: null, 

    init() {
        this.initDOM();
        this.initEvents();
    },

    initDOM() {
        this.highlightsToolBtn = document.getElementById('highlightsToolBtn');
        this.sliderPanel = document.getElementById('highlightsSliderControl');
        this.galleryView = document.getElementById('adjustGallery');
        this.slider = document.getElementById('highlightsSlider');
        
        this.confirmBtn = document.getElementById('confirmHighlightsBtn');
        this.discardBtn = document.getElementById('discardHighlightsBtn');
    },

    initEvents() {
        if (this.highlightsToolBtn) {
            this.highlightsToolBtn.addEventListener('click', () => this.startEditingSession());
        }

        this.slider.addEventListener('input', (e) => {
            const level = parseInt(e.target.value, 10); 
            this.processPixels(level);

            // LIVE PREVIEW INTERCEPT: Push value directly to global pipeline while scrubbing
            if (window.HistoryManager && typeof window.HistoryManager.updateValue === 'function') {
                window.HistoryManager.updateValue('highlights', level);
            }
        });

        this.confirmBtn.addEventListener('click', () => this.handleConfirm());
        this.discardBtn.addEventListener('click', () => this.handleDiscard());
    },

    startEditingSession() {
        if (!window.CanvasEditor) return;

        const baseCanvas = window.CanvasEditor.getWorkingImage();
        
        const currentBaseline = window.HistoryManager?.getBaseLineState()?.toolValues || {};
        this.slider.value = currentBaseline.highlights !== undefined ? currentBaseline.highlights : 0;

        this.toolBufferCanvas = document.createElement('canvas');
        this.toolBufferCanvas.width = baseCanvas.width;
        this.toolBufferCanvas.height = baseCanvas.height;
        
        const bufferCtx = this.toolBufferCanvas.getContext('2d');
        bufferCtx.drawImage(baseCanvas, 0, 0);

        this.originalImageData = bufferCtx.getImageData(0, 0, baseCanvas.width, baseCanvas.height);

        this.galleryView.style.display = 'none';
        this.sliderPanel.style.display = 'block';
    },

    processPixels(level) {
        if (!this.originalImageData || !this.toolBufferCanvas) return;

        const bufferCtx = this.toolBufferCanvas.getContext('2d');
        const width = this.toolBufferCanvas.width;
        const height = this.toolBufferCanvas.height;
        const newImgData = bufferCtx.createImageData(width, height);
        
        const src = this.originalImageData.data;
        const dest = newImgData.data;

        const factor = level / 100;

        for (let i = 0; i < src.length; i += 4) {
            const r = src[i];
            const g = src[i+1];
            const b = src[i+2];
            const a = src[i+3];

            const luma = 0.299 * r + 0.587 * g + 0.114 * b;

            let weight = 0;
            if (luma > 128) {
                weight = (luma - 128) / 128; 
            }

            if (factor >= 0) {
                dest[i]   = Math.min(255, r + (255 - r) * factor * weight);
                dest[i+1] = Math.min(255, g + (255 - g) * factor * weight);
                dest[i+2] = Math.min(255, b + (255 - b) * factor * weight);
            } else {
                dest[i]   = Math.max(0, r + r * factor * weight);
                dest[i+1] = Math.max(0, g + g * factor * weight);
                dest[i+2] = Math.max(0, b + b * factor * weight);
            }
            dest[i+3] = a; 
        }

        bufferCtx.putImageData(newImgData, 0, 0);

        if (window.imgState && window.imgState.imageXCanvas) {
            const previewCtx = window.imgState.imageXCanvas.getContext('2d');
            previewCtx.clearRect(0, 0, window.imgState.imageXCanvas.width, window.imgState.imageXCanvas.height);
            previewCtx.drawImage(this.toolBufferCanvas, 0, 0);
            window.CanvasEditor.redraw();
        }
    },

    handleConfirm() {
        if (window.HistoryManager) {
            const level = parseInt(this.slider.value, 10);
            window.HistoryManager.commitChange('Highlights Adjust', {
                type: 'baseline',
                values: { highlights: level }
            });
        }
        this.exitTool();
    },

    handleDiscard() {
        this.exitTool();
    },

    exitTool() {
        this.toolBufferCanvas = null;
        this.originalImageData = null;
        this.sliderPanel.style.display = 'none';
        this.galleryView.style.display = 'flex';
        window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
    }
};

document.addEventListener('DOMContentLoaded', () => HighlightsTool.init());
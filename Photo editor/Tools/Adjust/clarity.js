// clarity.js - Isolated Matrix Modifier Linked to History Baseline

const ClarityTool = {
    toolBufferCanvas: null,  
    originalImageData: null, 

    init() {
        this.initDOM();
        this.initEvents();
    },

    initDOM() {
        this.clarityToolBtn = document.getElementById('clarityToolBtn');
        this.sliderPanel = document.getElementById('claritySliderControl');
        this.galleryView = document.getElementById('adjustGallery');
        this.slider = document.getElementById('claritySlider');
        
        this.confirmBtn = document.getElementById('confirmClarityBtn');
        this.discardBtn = document.getElementById('discardClarityBtn');
    },

    initEvents() {
        if (this.clarityToolBtn) {
            this.clarityToolBtn.addEventListener('click', () => this.startEditingSession());
        }

        this.slider.addEventListener('input', (e) => {
            const level = parseInt(e.target.value, 10); 
            this.processPixels(level);

            // LIVE PREVIEW INTERCEPT: Update global core pipeline instantly
            if (window.HistoryManager && typeof window.HistoryManager.updateValue === 'function') {
                window.HistoryManager.updateValue('clarity', level);
            }
        });

        this.confirmBtn.addEventListener('click', () => this.handleConfirm());
        this.discardBtn.addEventListener('click', () => this.handleDiscard());
    },

    startEditingSession() {
        if (!window.CanvasEditor) return;

        const baseCanvas = window.CanvasEditor.getWorkingImage();
        
        // Load existing state value if available, default to 0
        const currentBaseline = window.HistoryManager?.getBaseLineState()?.toolValues || {};
        this.slider.value = currentBaseline.clarity !== undefined ? currentBaseline.clarity : 0;

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

        const factor = level / 50; 

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const i = (y * width + x) * 4;

                const r = src[i];
                const g = src[i+1];
                const b = src[i+2];
                const a = src[i+3];

                const luminance = (0.299 * r) + (0.587 * g) + (0.114 * b);
                const midtoneMask = 1.0 - Math.abs((luminance - 128) / 128);

                const topIdx   = ((y - 1) * width + x) * 4;
                const btmIdx   = ((y + 1) * width + x) * 4;
                const lftIdx   = (y * width + (x - 1)) * 4;
                const rgtIdx   = (y * width + (x + 1)) * 4;

                const blurR = (src[topIdx] + src[btmIdx] + src[lftIdx] + src[rgtIdx] + r) / 5;
                const blurG = (src[topIdx+1] + src[btmIdx+1] + src[lftIdx+1] + src[rgtIdx+1] + g) / 5;
                const blurB = (src[topIdx+2] + src[btmIdx+2] + src[lftIdx+2] + src[rgtIdx+2] + b) / 5;

                const detailR = r - blurR;
                const detailG = g - blurG;
                const detailB = b - blurB;

                dest[i]   = Math.min(255, Math.max(0, r + (detailR * factor * midtoneMask)));
                dest[i+1] = Math.min(255, Math.max(0, g + (detailG * factor * midtoneMask)));
                dest[i+2] = Math.min(255, Math.max(0, b + (detailB * factor * midtoneMask)));
                dest[i+3] = a; 
            }
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
            window.HistoryManager.commitChange('Clarity Adjust', {
                type: 'baseline',
                values: { clarity: level }
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

document.addEventListener('DOMContentLoaded', () => ClarityTool.init());
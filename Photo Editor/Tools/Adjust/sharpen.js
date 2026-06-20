// sharpen.js - High-Frequency Matrix Convolution Sharpening Tool

const SharpenTool = {
    toolBufferCanvas: null,  
    originalImageData: null, 

    init() {
        this.initDOM();
        this.initEvents();
    },

    initDOM() {
        this.sharpenToolBtn = document.getElementById('sharpenToolBtn');
        this.sliderPanel = document.getElementById('sharpenSliderControl');
        this.galleryView = document.getElementById('adjustGallery');
        this.slider = document.getElementById('sharpenSlider');
        
        this.confirmBtn = document.getElementById('confirmSharpenBtn');
        this.discardBtn = document.getElementById('discardSharpenBtn');
    },

    initEvents() {
        if (this.sharpenToolBtn) {
            this.sharpenToolBtn.addEventListener('click', () => this.startEditingSession());
        }

        this.slider.addEventListener('input', (e) => {
            const level = parseInt(e.target.value, 10); 
            this.processPixels(level);

            // LIVE PREVIEW INTERCEPT: Update global core pipeline instantly
            if (window.HistoryManager && typeof window.HistoryManager.updateValue === 'function') {
                window.HistoryManager.updateValue('sharpen', level);
            }
        });

        this.confirmBtn.addEventListener('click', () => this.handleConfirm());
        this.discardBtn.addEventListener('click', () => this.handleDiscard());
    },

    startEditingSession() {
        if (!window.CanvasEditor) return;
        
        const baseCanvas = window.CanvasEditor.getWorkingImage();
        
        const currentBaseline = window.HistoryManager?.getBaseLineState()?.toolValues || {};
        this.slider.value = currentBaseline.sharpen !== undefined ? currentBaseline.sharpen : 0;

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

        const w = (level / 100) * 0.5; 
        const centerWeight = 1 + (4 * w);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const i = (y * width + x) * 4;

                const topIdx = ((y - 1) * width + x) * 4;
                const btmIdx = ((y + 1) * width + x) * 4;
                const lftIdx = (y * width + (x - 1)) * 4;
                const rgtIdx = (y * width + (x + 1)) * 4;

                const rSharp = (src[i] * centerWeight) - (src[topIdx] * w) - (src[btmIdx] * w) - (src[lftIdx] * w) - (src[rgtIdx] * w);
                dest[i] = Math.min(255, Math.max(0, rSharp));

                const gSharp = (src[i+1] * centerWeight) - (src[topIdx+1] * w) - (src[btmIdx+1] * w) - (src[lftIdx+1] * w) - (src[rgtIdx+1] * w);
                dest[i+1] = Math.min(255, Math.max(0, gSharp));

                const bSharp = (src[i+2] * centerWeight) - (src[topIdx+2] * w) - (src[btmIdx+2] * w) - (src[lftIdx+2] * w) - (src[rgtIdx+2] * w);
                dest[i+2] = Math.min(255, Math.max(0, bSharp));

                dest[i+3] = src[i+3];
            }
        }

        this.fillEdgePerimeter(src, dest, width, height);
        bufferCtx.putImageData(newImgData, 0, 0);
        
        if (window.imgState && window.imgState.imageXCanvas) {
            const previewCtx = window.imgState.imageXCanvas.getContext('2d');
            previewCtx.clearRect(0, 0, window.imgState.imageXCanvas.width, window.imgState.imageXCanvas.height);
            previewCtx.drawImage(this.toolBufferCanvas, 0, 0);
            window.CanvasEditor.redraw();
        }
    },

    fillEdgePerimeter(src, dest, width, height) {
        for (let x = 0; x < width; x++) {
            const topIdx = x * 4;
            const btmIdx = ((height - 1) * width + x) * 4;
            for (let c = 0; c < 4; c++) {
                dest[topIdx + c] = src[topIdx + c];
                dest[btmIdx + c] = src[btmIdx + c];
            }
        }
        for (let y = 0; y < height; y++) {
            const lftIdx = (y * width) * 4;
            const rgtIdx = (y * width + (width - 1)) * 4;
            for (let c = 0; c < 4; c++) {
                dest[lftIdx + c] = src[lftIdx + c];
                dest[rgtIdx + c] = src[rgtIdx + c];
            }
        }
    },

    handleConfirm() {
        if (window.HistoryManager) {
            const level = parseInt(this.slider.value, 10);
            window.HistoryManager.commitChange('Sharpen Adjust', {
                type: 'baseline',
                values: { sharpen: level }
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

document.addEventListener('DOMContentLoaded', () => SharpenTool.init());
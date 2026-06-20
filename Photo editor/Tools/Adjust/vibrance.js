// vibrance.js - Pixel-Isolated High-Resolution Transformation Tool

const VibranceTool = {
    toolBufferCanvas: null,  
    originalImageData: null, 

    init() {
        this.initDOM();
        this.initEvents();
    },

    initDOM() {
        this.vibranceToolBtn = document.getElementById('vibranceToolBtn');
        this.sliderPanel = document.getElementById('vibranceSliderControl');
        this.galleryView = document.getElementById('adjustGallery');
        this.slider = document.getElementById('vibranceSlider');
        
        this.confirmBtn = document.getElementById('confirmVibranceBtn');
        this.discardBtn = document.getElementById('discardVibranceBtn');
    },

    initEvents() {
        if (this.vibranceToolBtn) {
            this.vibranceToolBtn.addEventListener('click', () => this.startEditingSession());
        }

        this.slider.addEventListener('input', (e) => {
            const level = parseInt(e.target.value, 10); 
            this.processPixels(level);

            // LIVE PREVIEW INTERCEPT: Update global core pipeline instantly
            if (window.HistoryManager && typeof window.HistoryManager.updateValue === 'function') {
                window.HistoryManager.updateValue('vibrance', level);
            }
        });

        this.confirmBtn.addEventListener('click', () => this.handleConfirm());
        this.discardBtn.addEventListener('click', () => this.handleDiscard());
    },

    startEditingSession() {
        if (!window.CanvasEditor) return;
        
        const workingSource = window.CanvasEditor.getWorkingImage();
        if (!workingSource) return;

        const currentBaseline = window.HistoryManager?.getBaseLineState()?.toolValues || {};
        this.slider.value = currentBaseline.vibrance !== undefined ? currentBaseline.vibrance : 0;

        this.toolBufferCanvas = document.createElement('canvas');
        this.toolBufferCanvas.width = workingSource.width;
        this.toolBufferCanvas.height = workingSource.height;
        
        const bufferCtx = this.toolBufferCanvas.getContext('2d');
        bufferCtx.drawImage(workingSource, 0, 0);

        this.originalImageData = bufferCtx.getImageData(0, 0, workingSource.width, workingSource.height);

        this.galleryView.style.display = 'none';
        this.sliderPanel.style.display = 'block';
    },

    processPixels(level) {
        if (!this.originalImageData || !this.toolBufferCanvas) return;

        const bufferCtx = this.toolBufferCanvas.getContext('2d');
        const newImgData = bufferCtx.createImageData(this.toolBufferCanvas.width, this.toolBufferCanvas.height);
        
        const src = this.originalImageData.data;
        const dest = newImgData.data;

        const amt = level / 100;

        for (let i = 0; i < src.length; i += 4) {
            let r = src[i];
            let g = src[i+1];
            let b = src[i+2];
            let a = src[i+3];

            const max = Math.max(r, Math.max(g, b));
            const min = Math.min(r, Math.min(g, b));

            const currentSat = (max - min) / 255;
            const vibranceAmt = amt * (1.0 - currentSat) * 0.75;

            let newR = r + (max - r) * vibranceAmt;
            let newG = g + (max - g) * vibranceAmt;
            let newB = b + (max - b) * vibranceAmt;

            dest[i]   = Math.min(255, Math.max(0, newR)); 
            dest[i+1] = Math.min(255, Math.max(0, newG)); 
            dest[i+2] = Math.min(255, Math.max(0, newB)); 
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
            window.HistoryManager.commitChange('Vibrance Adjust', {
                type: 'baseline',
                values: { vibrance: level }
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

document.addEventListener('DOMContentLoaded', () => VibranceTool.init());
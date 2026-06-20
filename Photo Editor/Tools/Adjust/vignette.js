// vignette.js - Radial Center-Weighted Exposure Transformation Tool

const VignetteTool = {
    toolBufferCanvas: null,  
    originalImageData: null, 

    init() {
        this.initDOM();
        this.initEvents();
    },

    initDOM() {
        this.vignetteToolBtn = document.getElementById('vignetteToolBtn');
        this.sliderPanel = document.getElementById('vignetteSliderControl');
        this.galleryView = document.getElementById('adjustGallery');
        this.slider = document.getElementById('vignetteSlider');
        
        this.confirmBtn = document.getElementById('confirmVignetteBtn');
        this.discardBtn = document.getElementById('discardVignetteBtn');
    },

    initEvents() {
        if (this.vignetteToolBtn) {
            this.vignetteToolBtn.addEventListener('click', () => this.startEditingSession());
        }

        this.slider.addEventListener('input', (e) => {
            const level = parseInt(e.target.value, 10); 
            this.processPixels(level);

            // LIVE PREVIEW INTERCEPT: Update global core pipeline instantly
            if (window.HistoryManager && typeof window.HistoryManager.updateValue === 'function') {
                window.HistoryManager.updateValue('vignette', level);
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
        this.slider.value = currentBaseline.vignette !== undefined ? currentBaseline.vignette : 0;

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
        const width = this.toolBufferCanvas.width;
        const height = this.toolBufferCanvas.height;
        const newImgData = bufferCtx.createImageData(width, height);
        
        const src = this.originalImageData.data;
        const dest = newImgData.data;

        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);
        const intensity = (level / 100) * 0.8;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;

                const dx = x - centerX;
                const dy = y - centerY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const normDist = dist / maxRadius;

                const vignetteFactor = 1.0 + (intensity * (normDist * normDist));

                dest[i]     = Math.min(255, Math.max(0, src[i] * vignetteFactor));     
                dest[i+1]   = Math.min(255, Math.max(0, src[i+1] * vignetteFactor));   
                dest[i+2]   = Math.min(255, Math.max(0, src[i+2] * vignetteFactor));   
                dest[i+3]   = src[i+3];                                                 
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
            window.HistoryManager.commitChange('Vignette Adjust', {
                type: 'baseline',
                values: { vignette: level }
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

document.addEventListener('DOMContentLoaded', () => VignetteTool.init());
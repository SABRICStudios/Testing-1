/**
 * Tools/Details/details_manager.js
 * UI Listener, Controller, and History Coordinator for the Details Enhancer Tool
 */

if (!window.DetailsEngine) {
    window.DetailsEngine = {
        process: (imgData, settings) => imgData
    };
}

window.DetailsManager = {
    activeState: {
        sharpenAmount: 0,
        sharpenRadius: 1.0,
        sharpenThreshold: 25,
        sharpenMasking: 0,
        noiseLuminance: 0,
        noiseLumDetail: 50,
        noiseColor: 0
    },
    
    backupSnapshot: null,

    init() {
        this.cacheDOM();
        this.bindEvents();
    },

    cacheDOM() {
        this.dom = {
            openTriggerBtn: document.getElementById('detailsBtn'),
            panel: document.getElementById('detailsPanel'),
            previewCanvas: document.getElementById('detailsPreviewCanvas'),
            
            // Sharpen Sliders & Labels
            sliderAmount: document.getElementById('detailSharpenAmount'),
            sliderRadius: document.getElementById('detailSharpenRadius'),
            sliderThreshold: document.getElementById('detailSharpenDetail'),
            sliderMasking: document.getElementById('detailSharpenMasking'),
            labelAmount: document.getElementById('sharpenAmountVal'),
            labelRadius: document.getElementById('sharpenRadiusVal'),
            labelThreshold: document.getElementById('sharpenDetailVal'),
            labelMasking: document.getElementById('sharpenMaskingVal'),
            
            // Noise Reduction Sliders & Labels
            sliderNoiseLum: document.getElementById('detailDenoiseLuminance'),
            sliderNoiseLumDetail: document.getElementById('detailDenoiseLumDetail'),
            sliderNoiseColor: document.getElementById('detailDenoiseColor'),
            labelNoiseLum: document.getElementById('denoiseLuminanceVal'),
            labelNoiseLumDetail: document.getElementById('denoiseLumDetailVal'),
            labelNoiseColor: document.getElementById('denoiseColorVal'),
            
            // Actions
            confirmBtn: document.getElementById('confirmDetailsBtn'),
            discardBtn: document.getElementById('discardDetailsBtn')
        };
    },

    bindEvents() {
        this.dom.openTriggerBtn?.addEventListener('click', (e) => {
            e.preventDefault();
            this.openPanel();
        });

        if (!this.dom.panel) return;

        // --- Sharpen Inputs ---
        this.dom.sliderAmount?.addEventListener('input', (e) => {
            this.activeState.sharpenAmount = parseFloat(e.target.value);
            if (this.dom.labelAmount) this.dom.labelAmount.textContent = this.activeState.sharpenAmount;
            this.requestPipelinePreview();
        });
        this.dom.sliderRadius?.addEventListener('input', (e) => {
            this.activeState.sharpenRadius = parseFloat(e.target.value);
            if (this.dom.labelRadius) this.dom.labelRadius.textContent = this.activeState.sharpenRadius.toFixed(1) + " px";
            this.requestPipelinePreview();
        });
        this.dom.sliderThreshold?.addEventListener('input', (e) => {
            this.activeState.sharpenThreshold = parseFloat(e.target.value);
            if (this.dom.labelThreshold) this.dom.labelThreshold.textContent = this.activeState.sharpenThreshold;
            this.requestPipelinePreview();
        });
        this.dom.sliderMasking?.addEventListener('input', (e) => {
            this.activeState.sharpenMasking = parseFloat(e.target.value);
            if (this.dom.labelMasking) this.dom.labelMasking.textContent = this.activeState.sharpenMasking;
            this.requestPipelinePreview();
        });

        // --- Noise Reduction Inputs ---
        this.dom.sliderNoiseLum?.addEventListener('input', (e) => {
            this.activeState.noiseLuminance = parseFloat(e.target.value);
            if (this.dom.labelNoiseLum) this.dom.labelNoiseLum.textContent = this.activeState.noiseLuminance;
            this.requestPipelinePreview();
        });
        this.dom.sliderNoiseLumDetail?.addEventListener('input', (e) => {
            this.activeState.noiseLumDetail = parseFloat(e.target.value);
            if (this.dom.labelNoiseLumDetail) this.dom.labelNoiseLumDetail.textContent = this.activeState.noiseLumDetail;
            this.requestPipelinePreview();
        });
        this.dom.sliderNoiseColor?.addEventListener('input', (e) => {
            this.activeState.noiseColor = parseFloat(e.target.value);
            if (this.dom.labelNoiseColor) this.dom.labelNoiseColor.textContent = this.activeState.noiseColor;
            this.requestPipelinePreview();
        });

        // --- Actions ---
        this.dom.confirmBtn?.addEventListener('click', () => this.confirmModifications());
        this.dom.discardBtn?.addEventListener('click', () => this.discardModifications());
    },

    openPanel() {
        if (!this.dom.panel) return;
        
        if (window.HistoryManager && typeof window.HistoryManager.getCurrentParameters === 'function') {
            const currentRecord = window.HistoryManager.getCurrentParameters();
            if (currentRecord && currentRecord.details) {
                this.activeState = JSON.parse(JSON.stringify(currentRecord.details));
            }
        }

        this.backupSnapshot = JSON.parse(JSON.stringify(this.activeState));
        this.syncSlidersToState();
        this.dom.panel.style.display = 'block';
        this.renderMicroTexturePreview();
    },

    syncSlidersToState() {
        // Set Sharpen Sliders
        if (this.dom.sliderAmount) this.dom.sliderAmount.value = this.activeState.sharpenAmount;
        if (this.dom.sliderRadius) this.dom.sliderRadius.value = this.activeState.sharpenRadius;
        if (this.dom.sliderThreshold) this.dom.sliderThreshold.value = this.activeState.sharpenThreshold;
        if (this.dom.sliderMasking) this.dom.sliderMasking.value = this.activeState.sharpenMasking;
        
        // Set Sharpen Labels
        if (this.dom.labelAmount) this.dom.labelAmount.textContent = this.activeState.sharpenAmount;
        if (this.dom.labelRadius) this.dom.labelRadius.textContent = this.activeState.sharpenRadius.toFixed(1) + " px";
        if (this.dom.labelThreshold) this.dom.labelThreshold.textContent = this.activeState.sharpenThreshold;
        if (this.dom.labelMasking) this.dom.labelMasking.textContent = this.activeState.sharpenMasking;

        // Set Denoise Sliders
        if (this.dom.sliderNoiseLum) this.dom.sliderNoiseLum.value = this.activeState.noiseLuminance;
        if (this.dom.sliderNoiseLumDetail) this.dom.sliderNoiseLumDetail.value = this.activeState.noiseLumDetail;
        if (this.dom.sliderNoiseColor) this.dom.sliderNoiseColor.value = this.activeState.noiseColor;

        // Set Denoise Labels
        if (this.dom.labelNoiseLum) this.dom.labelNoiseLum.textContent = this.activeState.noiseLuminance;
        if (this.dom.labelNoiseLumDetail) this.dom.labelNoiseLumDetail.textContent = this.activeState.noiseLumDetail;
        if (this.dom.labelNoiseColor) this.dom.labelNoiseColor.textContent = this.activeState.noiseColor;
    },

    syncState(historyDetailsState) {
        if (!historyDetailsState) return;
        this.activeState = JSON.parse(JSON.stringify(historyDetailsState));
        this.syncSlidersToState();
        this.renderMicroTexturePreview();
    },

    requestPipelinePreview() {
        window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
        this.renderMicroTexturePreview();
    },

    renderMicroTexturePreview() {
        if (!this.dom.previewCanvas || !window.imgState || !window.imgState.img) return;

        const canvas = this.dom.previewCanvas;
        const ctx = canvas.getContext('2d');
        const cw = canvas.clientWidth || 320;
        const ch = canvas.clientHeight || 160;

        if (canvas.width !== cw || canvas.height !== ch) {
            canvas.width = cw;
            canvas.height = ch;
        }

        const sourceImg = window.imgState.img;
        const cropX = Math.max(0, (sourceImg.width - cw) / 2);
        const cropY = Math.max(0, (sourceImg.height - ch) / 2);

        ctx.clearRect(0, 0, cw, ch);
        
        try {
            ctx.drawImage(sourceImg, cropX, cropY, cw, ch, 0, 0, cw, ch);
            
            if (window.DetailsEngine && typeof window.DetailsEngine.process === 'function') {
                let imgData = ctx.getImageData(0, 0, cw, ch);
                imgData = window.DetailsEngine.process(imgData, this.activeState);
                ctx.putImageData(imgData, 0, 0);
            }
        } catch (e) {
            console.warn("Details preview texture context not ready yet:", e);
        }
    },

    confirmModifications() {
        if (window.HistoryManager) {
            window.HistoryManager.commitChange("Detail Enhancement", {
                type: 'details',
                values: JSON.parse(JSON.stringify(this.activeState))
            });
        }
        this.closePanel();
    },

    discardModifications() {
        this.activeState = JSON.parse(JSON.stringify(this.backupSnapshot));
        this.requestPipelinePreview();
        this.closePanel();
    },

    closePanel() {
        if (this.dom.panel) this.dom.panel.style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.DetailsManager.init();
}); 
/**
 * Tools/Details/OPERATIONS/details_engine.js
 * Coordinator combining Edge Masking and Unsharp Masking 
 */

window.DetailsEngine = {
    process(imgData, settings) {
        let workingData = imgData;

        // 1. Generate the edge isolation mask if Masking slider > 0
        let edgeMaskArray = null;
        if (settings.sharpenMasking > 0) {
            edgeMaskArray = window.DetailsMasking.generate(workingData, settings.sharpenMasking);
        }

        // 2. Execute the unsharp mask pass if Amount > 0
        if (settings.sharpenAmount > 0) {
            workingData = window.DetailsSharpen.apply(workingData, settings, edgeMaskArray);
        }

        // 3. (Optional) Denoise step can go here later when implemented
        // if (settings.noiseLuminance > 0 || settings.noiseColor > 0) { ... }

        return workingData;
    }
};

if (!window.DetailsEngine) {
    window.DetailsEngine = {
        process: (imgData, settings) => imgData
    };
}

// Change your activeState object inside details_manager.js to this:
window.DetailsManager = {
    activeState: {
        sharpenAmount: 0,
        sharpenRadius: 1.0,
        sharpenThreshold: 25,
        sharpenMasking: 0,
        noiseLuminance: 0,
        noiseLuminanceDetail: 50,
        noiseColor: 0,
        noiseColorDetail: 50      
    },
    
    // ... rest of your details_manager.js properties below ...
    
    backupSnapshot: null,
    // Store relative crop focus coordinates (0.5 means center of the image)
    cropFocusX: 0.5,
    cropFocusY: 0.5,
    isPanelOpen: false,

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.setupCanvasInteractivity();
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

            // Denoise Sliders & Labels
            sliderLuminance: document.getElementById('detailDenoiseLuminance'),
            sliderLumDetail: document.getElementById('detailDenoiseLumDetail'),
            sliderColor: document.getElementById('detailDenoiseColor'),
            labelLuminance: document.getElementById('denoiseLuminanceVal'),
            labelLumDetail: document.getElementById('denoiseLumDetailVal'),
            labelColor: document.getElementById('denoiseColorVal'),

            // Actions
            confirmBtn: document.getElementById('confirmDetailsBtn'),
            discardBtn: document.getElementById('discardDetailsBtn')
        };
    },

    bindEvents() {
        if (this.dom.openTriggerBtn) {
            this.dom.openTriggerBtn.addEventListener('click', () => this.openPanel());
        }
        if (this.dom.confirmBtn) {
            this.dom.confirmBtn.addEventListener('click', () => this.confirmModifications());
        }
        if (this.dom.discardBtn) {
            this.dom.discardBtn.addEventListener('click', () => this.discardModifications());
        }

        // Live input listeners for ultra-fast UI numerical updates
        const inputs = [
            { el: this.dom.sliderAmount, key: 'sharpenAmount', lbl: this.dom.labelAmount, suffix: '' },
            { el: this.dom.sliderRadius, key: 'sharpenRadius', lbl: this.dom.labelRadius, suffix: ' px' },
            { el: this.dom.sliderThreshold, key: 'sharpenThreshold', lbl: this.dom.labelThreshold, suffix: '' },
            { el: this.dom.sliderMasking, key: 'sharpenMasking', lbl: this.dom.labelMasking, suffix: '' },
            { el: this.dom.sliderLuminance, key: 'noiseLuminance', lbl: this.dom.labelLuminance, suffix: '' },
            { el: this.dom.sliderLumDetail, key: 'noiseLuminanceDetail', lbl: this.dom.labelLumDetail, suffix: '' }, // Verified key name match
            { el: this.dom.sliderColor, key: 'noiseColor', lbl: this.dom.labelColor, suffix: '' }
        ];

        inputs.forEach(item => {
            if (item.el) {
                item.el.addEventListener('input', (e) => {
                    const val = parseFloat(e.target.value);
                    this.activeState[item.key] = val;
                    if (item.lbl) item.lbl.textContent = val + item.suffix;
                    
                    // Render ONLY the tiny preview canvas instantly during CPU scrubbing
                    this.renderPreviewCanvas();
                });
            }
        });
    },

    // Allows the user to tap on the main image canvas to focus the micro-texture preview
    setupCanvasInteractivity() {
        const mainCanvas = document.getElementById('canvas') || document.getElementById('mainCanvas');
        if (!mainCanvas) return;

        const handleFocusChange = (e) => {
            if (!this.isPanelOpen) return;
            const rect = mainCanvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            // Calculate normalized percentage (0 to 1) across the canvas viewport
            this.cropFocusX = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
            this.cropFocusY = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
            
            this.renderPreviewCanvas();
        };

        mainCanvas.addEventListener('click', handleFocusChange);
        mainCanvas.addEventListener('touchstart', handleFocusChange, { passive: true });
    },

    openPanel() {
        this.isPanelOpen = true;
        this.backupSnapshot = JSON.parse(JSON.stringify(this.activeState));
        if (this.dom.panel) this.dom.panel.style.display = 'block';
        
        // Match sliders with active state values
        this.syncUIFromState();
        this.renderPreviewCanvas();
    },

    closePanel() {
        this.isPanelOpen = false;
        if (this.dom.panel) this.dom.panel.style.display = 'none';
    },

    syncUIFromState() {
        const state = this.activeState;
        if (this.dom.sliderAmount) this.dom.sliderAmount.value = state.sharpenAmount;
        if (this.dom.labelAmount) this.dom.labelAmount.textContent = state.sharpenAmount;

        if (this.dom.sliderRadius) this.dom.sliderRadius.value = state.sharpenRadius;
        if (this.dom.labelRadius) this.dom.labelRadius.textContent = state.sharpenRadius + ' px';

        if (this.dom.sliderThreshold) this.dom.sliderThreshold.value = state.sharpenThreshold;
        if (this.dom.labelThreshold) this.dom.labelThreshold.textContent = state.sharpenThreshold;

        if (this.dom.sliderMasking) this.dom.sliderMasking.value = state.sharpenMasking;
        if (this.dom.labelMasking) this.dom.labelMasking.textContent = state.sharpenMasking;

        if (this.dom.sliderLuminance) this.dom.sliderLuminance.value = state.noiseLuminance;
        if (this.dom.labelLuminance) this.dom.labelLuminance.textContent = state.noiseLuminance;

        if (this.dom.sliderLumDetail) this.dom.sliderLumDetail.value = state.noiseLumDetail;
        if (this.dom.labelLumDetail) this.dom.labelLumDetail.textContent = state.noiseLumDetail;

        if (this.dom.sliderColor) this.dom.sliderColor.value = state.noiseColor;
        if (this.dom.labelColor) this.dom.labelColor.textContent = state.noiseColor;
    },

renderPreviewCanvas() {
        if (!this.isPanelOpen || !window.imgState || !window.imgState.img) return;

        const canvas = this.dom.previewCanvas;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        
        // 1. Force the canvas drawing buffer dimensions to match its exact display layout size
        const displayW = canvas.clientWidth || 160;
        const displayH = canvas.clientHeight || 160;

        if (canvas.width !== displayW || canvas.height !== displayH) {
            canvas.width = displayW;
            canvas.height = displayH;
        }

        const sourceImg = window.imgState.img;
        
        // 2. Calculate coordinates based on interactive tap mapping
        let cropX = Math.floor(this.cropFocusX * sourceImg.width - displayW / 2);
        let cropY = Math.floor(this.cropFocusY * sourceImg.height - displayH / 2);
        
        // 3. Keep crop bounds strictly clamped inside the physical limits of the source asset
        cropX = Math.max(0, Math.min(sourceImg.width - displayW, cropX));
        cropY = Math.max(0, Math.min(sourceImg.height - displayH, cropY));

        ctx.clearRect(0, 0, displayW, displayH);
        
        try {
            // 4. Draw a clean 1:1 scale micro-region directly onto the canvas buffer
            ctx.drawImage(sourceImg, cropX, cropY, displayW, displayH, 0, 0, displayW, displayH);
            
            // 5. Run the pixel manipulation effects pipeline over this micro-grid
            if (window.DetailsEngine && typeof window.DetailsEngine.process === 'function') {
                let imgData = ctx.getImageData(0, 0, displayW, displayH);
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
        this.requestPipelinePreview();
    },

    discardModifications() {
        this.activeState = JSON.parse(JSON.stringify(this.backupSnapshot));
        this.closePanel();
        this.requestPipelinePreview();
    },

    requestPipelinePreview() {
        // Dispatch event back to main pipeline loop to render changes onto full image canvas
        window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
    }
};

// Auto-initialize when file lands
document.addEventListener('DOMContentLoaded', () => {
    window.DetailsManager.init();
});
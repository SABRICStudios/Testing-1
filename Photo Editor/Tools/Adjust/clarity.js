// clarity.js - Optimized for Centered Pipeline Operations
const ClarityTool = {
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
            
            // Instantly communicate values downstream to central orchestrator
            if (window.HistoryManager && typeof window.HistoryManager.updateValue === 'function') {
                window.HistoryManager.updateValue('clarity', level);
            }
        });

        this.confirmBtn.addEventListener('click', () => this.handleConfirm());
        this.discardBtn.addEventListener('click', () => this.handleDiscard());
    },

    startEditingSession() {
        if (!window.CanvasEditor) return;

        if (window.HistoryManager) {
            window.HistoryManager.backupActiveSessionState();
        }

        const currentBaseline = window.HistoryManager?.getCurrentParameters()?.baseline || {};
        this.slider.value = currentBaseline.clarity !== undefined ? currentBaseline.clarity : 0;

        // Turn on Live Scrubbing Optimization Mode (Downsamples preview calculations)
        window.CanvasEditor.isScrubbing = true;

        this.galleryView.style.display = 'none';
        this.sliderPanel.style.display = 'block';
    },

    handleConfirm() {
        window.CanvasEditor.isScrubbing = false; // Turn off downsampling
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
        window.CanvasEditor.isScrubbing = false;
        if (window.HistoryManager) {
            window.HistoryManager.revertActiveSessionState();
        }
        this.exitTool();
    },

    exitTool() {
        this.sliderPanel.style.display = 'none';
        this.galleryView.style.display = 'flex';
        window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
    }
};

document.addEventListener('DOMContentLoaded', () => ClarityTool.init());
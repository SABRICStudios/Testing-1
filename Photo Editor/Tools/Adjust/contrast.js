// contrast.js - Refactored for State-Driven Non-Destructive History

const ContrastTool = {
    slider: null,
    confirmBtn: null,
    discardBtn: null,

    init() {
        this.initDOM();
        this.initEvents();
    },

    initDOM() {
        this.contrastToolBtn = document.getElementById('contrastToolBtn');
        this.sliderPanel = document.getElementById('contrastSliderControl');
        this.galleryView = document.getElementById('adjustGallery');
        this.slider = document.getElementById('contrastSlider');
        this.confirmBtn = document.getElementById('confirmContrastBtn');
        this.discardBtn = document.getElementById('discardContrastBtn');
    },

    initEvents() {
        if (this.contrastToolBtn) {
            this.contrastToolBtn.addEventListener('click', () => this.startEditingSession());
        }

        this.slider.addEventListener('input', (e) => {
            if (window.ParameterHistory) {
                window.ParameterHistory.updateValue('contrast', e.target.value);
            }
        });

        this.confirmBtn.addEventListener('click', () => this.handleConfirm());
        this.discardBtn.addEventListener('click', () => this.handleDiscard());
    },

    startEditingSession() {
        if (window.ParameterHistory) window.ParameterHistory.startSession();
        this.galleryView.style.display = 'none';
        this.sliderPanel.style.display = 'block';
    },

    handleConfirm() {
        if (window.ParameterHistory) {
            window.ParameterHistory.confirmSession('Contrast Adjust');
        }
        this.exitTool();
    },

    handleDiscard() {
        if (window.ParameterHistory) {
            window.ParameterHistory.discardSession();
        }
        this.exitTool();
    },

    exitTool() {
        this.sliderPanel.style.display = 'none';
        this.galleryView.style.display = 'flex';
    }
};

document.addEventListener('DOMContentLoaded', () => ContrastTool.init());
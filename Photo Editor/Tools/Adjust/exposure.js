// exposure.js - Refactored for State-Driven Non-Destructive History

const ExposureTool = {
    slider: null,
    confirmBtn: null,
    discardBtn: null,

    init() {
        this.initDOM();
        this.initEvents();
    },

    initDOM() {
        this.exposureToolBtn = document.getElementById('exposureToolBtn');
        this.sliderPanel = document.getElementById('exposureSliderControl');
        this.galleryView = document.getElementById('adjustGallery');
        this.slider = document.getElementById('exposureSlider');
        this.confirmBtn = document.getElementById('confirmExposureBtn');
        this.discardBtn = document.getElementById('discardExposureBtn');
    },

    initEvents() {
        if (this.exposureToolBtn) {
            this.exposureToolBtn.addEventListener('click', () => this.startEditingSession());
        }

        this.slider.addEventListener('input', (e) => {
            if (window.ParameterHistory) {
                window.ParameterHistory.updateValue('exposure', e.target.value);
            }
        });

        if (this.confirmBtn) this.confirmBtn.addEventListener('click', () => this.handleConfirm());
        if (this.discardBtn) this.discardBtn.addEventListener('click', () => this.handleDiscard());
    },

    startEditingSession() {
        if (window.ParameterHistory) window.ParameterHistory.startSession();
        this.galleryView.style.display = 'none';
        this.sliderPanel.style.display = 'block';
    },

    handleConfirm() {
        if (window.ParameterHistory) {
            window.ParameterHistory.confirmSession('Exposure Adjust');
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

document.addEventListener('DOMContentLoaded', () => ExposureTool.init());
// saturation.js - Refactored for State-Driven Non-Destructive History

const SaturationTool = {
    slider: null,
    confirmBtn: null,
    discardBtn: null,

    init() {
        this.initDOM();
        this.initEvents();
    },

    initDOM() {
        this.saturationToolBtn = document.getElementById('saturationToolBtn');
        this.sliderPanel = document.getElementById('saturationSliderControl');
        this.galleryView = document.getElementById('adjustGallery');
        this.slider = document.getElementById('saturationSlider');
        this.confirmBtn = document.getElementById('confirmSaturationBtn');
        this.discardBtn = document.getElementById('discardSaturationBtn');
    },

    initEvents() {
        if (this.saturationToolBtn) {
            this.saturationToolBtn.addEventListener('click', () => this.startEditingSession());
        }

        this.slider.addEventListener('input', (e) => {
            if (window.ParameterHistory) {
                window.ParameterHistory.updateValue('saturation', e.target.value);
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
            window.ParameterHistory.confirmSession('Saturation Adjust');
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

document.addEventListener('DOMContentLoaded', () => SaturationTool.init());
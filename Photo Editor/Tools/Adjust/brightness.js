// brightness.js - Refactored for State-Driven Non-Destructive History

const BrightnessTool = {
    slider: null,
    confirmBtn: null,
    discardBtn: null,

    init() {
        this.initDOM();
        this.initEvents();
    },

    initDOM() {
        this.brightnessToolBtn = document.getElementById('brightnessToolBtn');
        this.sliderPanel = document.getElementById('brightnessSliderControl');
        this.galleryView = document.getElementById('adjustGallery');
        this.slider = document.getElementById('brightnessSlider');
        this.confirmBtn = document.getElementById('confirmBrightnessBtn');
        this.discardBtn = document.getElementById('discardBrightnessBtn');
    },

    initEvents() {
        if (this.brightnessToolBtn) {
            this.brightnessToolBtn.addEventListener('click', () => this.startEditingSession());
        }

        this.slider.addEventListener('input', (e) => {
            if (window.ParameterHistory) {
                window.ParameterHistory.updateValue('brightness', e.target.value);
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
            window.ParameterHistory.confirmSession('Brightness Adjust');
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

document.addEventListener('DOMContentLoaded', () => BrightnessTool.init());
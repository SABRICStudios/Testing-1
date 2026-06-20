// temperature.js - Refactored for State-Driven Non-Destructive History

const TemperatureTool = {
    slider: null,
    confirmBtn: null,
    discardBtn: null,

    init() {
        this.initDOM();
        this.initEvents();
    },

    initDOM() {
        this.tempToolBtn = document.getElementById('tempToolBtn');
        this.sliderPanel = document.getElementById('temperatureSliderControl');
        this.galleryView = document.getElementById('adjustGallery');
        this.slider = document.getElementById('tempSlider');
        this.confirmBtn = document.getElementById('confirmTempBtn');
        this.discardBtn = document.getElementById('discardTempBtn');
    },

    initEvents() {
        if (this.tempToolBtn) {
            this.tempToolBtn.addEventListener('click', () => this.startEditingSession());
        }

        this.slider.addEventListener('input', (e) => {
            if (window.ParameterHistory) {
                window.ParameterHistory.updateValue('temperature', e.target.value);
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
            window.ParameterHistory.confirmSession('Temperature Adjust');
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

document.addEventListener('DOMContentLoaded', () => TemperatureTool.init());
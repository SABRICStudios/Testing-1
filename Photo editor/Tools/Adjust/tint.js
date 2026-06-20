// tint.js - Refactored for State-Driven Non-Destructive History

const TintTool = {
    slider: null,
    confirmBtn: null,
    discardBtn: null,

    init() {
        this.initDOM();
        this.initEvents();
    },

    initDOM() {
        this.tintToolBtn = document.getElementById('tintToolBtn');
        this.sliderPanel = document.getElementById('tintSliderControl');
        this.galleryView = document.getElementById('adjustGallery');
        this.slider = document.getElementById('tintSlider');
        this.confirmBtn = document.getElementById('confirmTintBtn');
        this.discardBtn = document.getElementById('discardTintBtn');
    },

    initEvents() {
        if (this.tintToolBtn) {
            this.tintToolBtn.addEventListener('click', () => this.startEditingSession());
        }

        this.slider.addEventListener('input', (e) => {
            if (window.ParameterHistory) {
                window.ParameterHistory.updateValue('tint', e.target.value);
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
            window.ParameterHistory.confirmSession('Tint Adjust');
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

document.addEventListener('DOMContentLoaded', () => TintTool.init());
/**
 * Visuals Photo Editor - Masking Tool Manager
 * Handles UI interactions, visibility states, and slider configurations.
 */

const MaskingManager = {
    currentMaskType: 'brush', // 'brush', 'linear', 'radial', 'auto'
    
    init: function() {
        this.cacheDOM();
        this.bindEvents();
    },

    cacheDOM: function() {
        // Main Trigger Button
        this.maskingBtn = document.getElementById('maskingBtn');

        // Panels and Layout
        this.panel = document.getElementById('maskingPanel');
        this.galleryButtons = document.querySelectorAll('#maskingGallery .gallery-item-btn');
        this.controlGroups = document.querySelectorAll('.mask-control-group');
        
        // Sliders & Values
        this.brushSizeSlider = document.getElementById('maskBrushSize');
        this.brushSizeVal = document.getElementById('brushSizeVal');
        this.brushFeatherSlider = document.getElementById('maskBrushFeather');
        this.brushFeatherVal = document.getElementById('brushFeatherVal');
        this.gradientFeatherSlider = document.getElementById('maskGradientFeather');
        this.gradientFeatherVal = document.getElementById('gradientFeatherVal');
        this.toleranceSlider = document.getElementById('maskTolerance');
        this.toleranceVal = document.getElementById('autoMaskToleranceVal');
        this.globalOpacitySlider = document.getElementById('maskGlobalOpacity');
        this.globalOpacityVal = document.getElementById('maskOpacityVal');

        // Action Buttons
        this.invertBtn = document.getElementById('invertMaskGlobalBtn');
        this.confirmBtn = document.getElementById('confirmMaskBtn');
        this.discardBtn = document.getElementById('discardMaskBtn');
    },

    bindEvents: function() {
        // Toggle Panel Open when clicking the main entry button
        if (this.maskingBtn) {
            this.maskingBtn.addEventListener('click', () => {
                // If it's already open, close it (discarding changes), otherwise open it
                if (this.panel.style.display === 'flex') {
                    this.closePanel(false);
                } else {
                    this.openPanel();
                }
            });
        }

        // Gallery Mode Switching
        this.galleryButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetBtn = e.currentTarget;
                this.switchMaskType(targetBtn);
            });
        });

        // Live Slider Updates to Engine
        this.brushSizeSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            this.brushSizeVal.innerText = `${val} px`;
            MaskingEngine.settings.brushSize = parseInt(val);
        });

        this.brushFeatherSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            this.brushFeatherVal.innerText = `${val}%`;
            MaskingEngine.settings.brushFeather = parseInt(val) / 100;
        });

        this.gradientFeatherSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            this.gradientFeatherVal.innerText = `${val}%`;
            MaskingEngine.settings.gradientFeather = parseInt(val);
        });

        this.toleranceSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            this.toleranceVal.innerText = val;
            MaskingEngine.settings.tolerance = parseInt(val);
        });

        this.globalOpacitySlider.addEventListener('input', (e) => {
            const val = e.target.value;
            this.globalOpacityVal.innerText = `${val}%`;
            MaskingEngine.settings.globalOpacity = parseInt(val) / 100;
            MaskingEngine.redraw();
        });

        // Brush Add/Subtract mode selection
        document.querySelectorAll('input[name="brushMode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                MaskingEngine.settings.brushMode = e.target.value; // 'add' or 'subtract'
            });
        });

        // Global Actions
        this.invertBtn.addEventListener('click', () => MaskingEngine.invertMask());
        this.confirmBtn.addEventListener('click', () => this.closePanel(true));
        this.discardBtn.addEventListener('click', () => this.closePanel(false));
    },

    switchMaskType: function(selectedBtn) {
        // Update gallery item active visual states
        this.galleryButtons.forEach(btn => {
            btn.classList.remove('active-mask-btn');
            btn.style.color = '#aaa';
            const icon = btn.querySelector('i');
            if (icon) icon.style.color = '';
        });

        selectedBtn.classList.add('active-mask-btn');
        const activeIcon = selectedBtn.querySelector('i');
        if (activeIcon) activeIcon.style.color = '#00adb5';
        selectedBtn.style.color = 'white';

        // Toggle properties sub-panels
        const targetId = selectedBtn.getAttribute('data-target');
        this.controlGroups.forEach(group => {
            group.style.display = group.id === targetId ? 'block' : 'none';
        });

        // Update target configuration inside engine
        if (selectedBtn.id === 'brushMaskBtn') this.currentMaskType = 'brush';
        if (selectedBtn.id === 'linearMaskBtn') this.currentMaskType = 'linear';
        if (selectedBtn.id === 'radialMaskBtn') this.currentMaskType = 'radial';
        if (selectedBtn.id === 'autoMaskBtn') this.currentMaskType = 'auto';

        MaskingEngine.setMaskType(this.currentMaskType);
    },

    openPanel: function() {
        // Close other active manager panels here if needed (e.g., AdjustManager.closePanel())
        this.panel.style.display = 'flex';
        MaskingEngine.activate();
    },

    closePanel: function(applyChanges) {
        this.panel.style.display = 'none';
        MaskingEngine.deactivate(applyChanges);
    }
};

// Auto-initialize when content loads
document.addEventListener('DOMContentLoaded', () => {
    MaskingManager.init();
});
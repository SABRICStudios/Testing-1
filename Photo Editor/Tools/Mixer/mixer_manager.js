/**
 * Visuals Photo Editor - Mixer Brush Manager
 * Drives the tabbed tool selection framework mimicking the Adjust Gallery layout behavior.
 */

window.MixerEditor = {
    isOpen: false,
    originalImageBackup: null,
    settings: {
        size: 30,
        wet: 50,
        load: 50,
        mix: 50,
        loadAfterStroke: true,
        cleanAfterStroke: true
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const mixerBtn = document.getElementById('mixerBtn'); 
    const mixerToolBar = document.getElementById('mixerToolBar');
    const mainToolBar = document.getElementById('mainToolBar') || document.querySelector('.main-actions-toolbar') || document.querySelector('.toolbar');

    const btnMixerConfirm = document.getElementById('btnMixerConfirm');
    const btnMixerDiscard = document.getElementById('btnMixerDiscard');

    // Controls & Sliders Map
    const sliders = {
        size: { input: document.getElementById('mixerSize'), text: document.getElementById('mixerSizeVal'), suffix: ' px' },
        wet: { input: document.getElementById('mixerWet'), text: document.getElementById('mixerWetVal'), suffix: '%' },
        load: { input: document.getElementById('mixerLoad'), text: document.getElementById('mixerLoadVal'), suffix: '%' },
        mix: { input: document.getElementById('mixerMix'), text: document.getElementById('mixerMixVal'), suffix: '%' }
    };

    const panelsToClose = [
        'adjustPanel', 'filterPanel', 'transformPanel', 
        'detailsPanel', 'blurPanel', 'curvesPanel'
    ];

    // --- Sub-Gallery View Toggle Handler Engine ---
    const galleryButtons = document.querySelectorAll('.mixer-gallery-btn');
    const mixerSliders = document.querySelectorAll('.mixer-slider-group');

    galleryButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active rendering properties from previous buttons
            galleryButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Toggle slider view panels down below
            const targetId = button.getAttribute('data-mixer-target');
            mixerSliders.forEach(sliderPanel => {
                if (sliderPanel.id === targetId) {
                    sliderPanel.style.display = 'block';
                } else {
                    sliderPanel.style.display = 'none';
                }
            });
        });
    });

    function openMixerPanel() {
        if (!mixerToolBar) return;
        MixerEditor.isOpen = true;

        // Close conflicting panels
        panelsToClose.forEach(id => {
            const panel = document.getElementById(id);
            if (panel) panel.style.display = 'none';
        });

        if (mainToolBar) mainToolBar.style.display = 'none';
        mixerToolBar.style.display = 'block'; // Matches adjustPanel layout type styles

        // Fall back view states directly onto default first tab element context
        galleryButtons.forEach(btn => btn.classList.remove('active'));
        if (document.getElementById('toolMixerSizeBtn')) {
            document.getElementById('toolMixerSizeBtn').classList.add('active');
        }
        mixerSliders.forEach(sliderPanel => {
            sliderPanel.style.display = sliderPanel.id === 'mixerSizeControl' ? 'block' : 'none';
        });

        // Capture snapshot before editing begins
        if (window.imgState && window.imgState.imageXCanvas) {
            const ctx = window.imgState.imageXCanvas.getContext('2d');
            MixerEditor.originalImageBackup = ctx.getImageData(0, 0, window.imgState.imageXCanvas.width, window.imgState.imageXCanvas.height);
        }

        if (typeof initMixerEngine === 'function') {
            initMixerEngine();
        }
    }

    function closeMixerPanel(shouldCommitChanges) {
        MixerEditor.isOpen = false;

        if (typeof shutdownMixerEngine === 'function') {
            shutdownMixerEngine();
        }

        if (!shouldCommitChanges && MixerEditor.originalImageBackup && window.imgState && window.imgState.imageXCanvas) {
            if (window.CanvasEditor && typeof window.CanvasEditor.rollbackDirectCanvasChanges === 'function') {
                window.CanvasEditor.rollbackDirectCanvasChanges(MixerEditor.originalImageBackup);
            } else {
                const ctx = window.imgState.imageXCanvas.getContext('2d');
                ctx.putImageData(MixerEditor.originalImageBackup, 0, 0);
                if (window.CanvasEditor && typeof window.CanvasEditor.redraw === 'function') {
                    window.CanvasEditor.redraw();
                }
            }
        } else if (shouldCommitChanges) {
            if (window.CanvasEditor && typeof window.CanvasEditor.bakeDirectCanvasChanges === 'function') {
                window.CanvasEditor.bakeDirectCanvasChanges();
            }
        }

        if (mixerToolBar) mixerToolBar.style.display = 'none';
        if (mainToolBar) mainToolBar.style.display = 'flex';
    }

    // Connect trigger button elements
    if (mixerBtn) {
        mixerBtn.addEventListener('click', () => {
            if (!MixerEditor.isOpen) openMixerPanel();
        });
    }

    if (btnMixerDiscard) btnMixerDiscard.addEventListener('click', () => closeMixerPanel(false));
    if (btnMixerConfirm) btnMixerConfirm.addEventListener('click', () => closeMixerPanel(true));

    // Monitor range adjustment slide changes
    Object.keys(sliders).forEach(key => {
        const item = sliders[key];
        if (item.input) {
            item.input.addEventListener('input', (e) => {
                let val = parseInt(e.target.value);
                if (item.text) item.text.textContent = val + item.suffix;
                MixerEditor.settings[key] = val;
            });
        }
    });
});
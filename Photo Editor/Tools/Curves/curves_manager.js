/**
 * Visuals Photo Editor - Curves Manager Module
 * Handles UI toggles, channel state tracking, and lifecycle routines.
 */

let CurvesEditor = {
    activeChannel: 'rgb',
    curvesLUTs: { rgb: null, red: null, green: null, blue: null }, 
    isOpen: false,
    listenersInitialized: false 
};

document.addEventListener('DOMContentLoaded', () => {
    const curvesBtn = document.getElementById('curvesBtn');
    const curvesPanel = document.getElementById('curvesPanel');
    
    const adjustPanel = document.getElementById('adjustPanel');
    const filterPanel = document.getElementById('filterPanel');
    const transformPanel = document.getElementById('transformPanel');
    const detailsPanel = document.getElementById('detailsPanel');
    const blurPanel = document.getElementById('blurPanel');

    const confirmCurvesBtn = document.getElementById('confirmCurvesBtn');
    const curvesResetBtn = document.getElementById('curvesResetBtn');
    const discardCurvesBtn = document.getElementById('discardCurvesBtn');
    const channelButtons = document.querySelectorAll('.curve-channel-btn');

    function openCurvesPanel() {
        if (adjustPanel) adjustPanel.style.display = 'none';
        if (filterPanel) filterPanel.style.display = 'none';
        if (transformPanel) transformPanel.style.display = 'none';
        if (detailsPanel) detailsPanel.style.display = 'none';
        if (blurPanel) blurPanel.style.display = 'none';

        if (typeof channelPoints !== 'undefined') {
            fallbackChannelPoints = JSON.parse(JSON.stringify(channelPoints));
        }

        if (curvesPanel) curvesPanel.style.display = 'block';
        CurvesEditor.isOpen = true;

        if (typeof initCurvesEngine === 'function') {
            if (!CurvesEditor.listenersInitialized) {
                initCurvesEngine();
                CurvesEditor.listenersInitialized = true;
            } else {
                updateCurvesUI();
            }
        }
    }

    function closeCurvesPanel() {
        if (curvesPanel) curvesPanel.style.display = 'none';
        CurvesEditor.isOpen = false;
        // Clean global scrubbing flag states on interface dismissals
        window.CanvasEditor.isScrubbing = false;
    }

    if (curvesBtn) {
        curvesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (CurvesEditor.isOpen) {
                closeCurvesPanel();
            } else {
                openCurvesPanel();
            }
        });
    }

    channelButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            channelButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            const channel = e.target.getAttribute('data-channel') || e.target.textContent.toLowerCase().trim();
            CurvesEditor.activeChannel = channel;

            channelButtons.forEach(b => { b.style.background = ''; b.style.color = ''; });
            if (channel === 'red') { e.target.style.background = '#7f1d1d'; e.target.style.color = '#fca5a5'; }
            else if (channel === 'green') { e.target.style.background = '#14532d'; e.target.style.color = '#86efac'; }
            else if (channel === 'blue') { e.target.style.background = '#1e3a8a'; e.target.style.color = '#93c5fd'; }

            if (typeof updateCurvesUI === 'function') {
                updateCurvesUI();
            }
        });
    });

    if (curvesResetBtn) {
        curvesResetBtn.addEventListener('click', () => {
            if (typeof resetCurrentChannel === 'function') {
                resetCurrentChannel();
            }
        });
    }

    if (confirmCurvesBtn) {
        confirmCurvesBtn.addEventListener('click', () => {
            window.CanvasEditor.isScrubbing = false;
            window.canvasRenderPending = false;
            window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
            console.log("Curves changes permanently applied.");
            closeCurvesPanel();
        });
    }

    if (discardCurvesBtn) {
        discardCurvesBtn.addEventListener('click', () => {
            console.log("Curves changes discarded.");
            
            if (fallbackChannelPoints && typeof channelPoints !== 'undefined') {
                channelPoints = JSON.parse(JSON.stringify(fallbackChannelPoints));
            }

            CurvesEditor.curvesLUTs = { rgb: null, red: null, green: null, blue: null };

            if (window.CurvesManager && window.CurvesManager.activeState) {
                window.CurvesManager.activeState.active = false;
                window.CurvesManager.activeState.lutR = null;
                window.CurvesManager.activeState.lutG = null;
                window.CurvesManager.activeState.lutB = null;
            }

            if (typeof updateCurvesUI === 'function') {
                updateCurvesUI();
            }

            window.CanvasEditor.isScrubbing = false;
            window.canvasRenderPending = false;
            window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
            
            closeCurvesPanel();
        });
    }
});
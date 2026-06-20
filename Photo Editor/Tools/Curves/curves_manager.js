/**
 * Visuals Photo Editor - Curves Manager Module
 * Handles UI toggles, channel state tracking, and lifecycle routines.
 */

// Global context placeholder for the curves operational state
let CurvesEditor = {
    activeChannel: 'rgb',
    // Stashes 0-255 lookup tables for image processors [RGB, R, G, B]
    curvesLUTs: { rgb: null, red: null, green: null, blue: null }, 
    isOpen: false,
    listenersInitialized: false // CRITICAL: Stops event listener duplication causing ghost points
};

document.addEventListener('DOMContentLoaded', () => {
    // --- UI Element Selectors from photo_editor.html ---
    const curvesBtn = document.getElementById('curvesBtn');
    const curvesPanel = document.getElementById('curvesPanel');
    
    // Conflicting Panels
    const adjustPanel = document.getElementById('adjustPanel');
    const filterPanel = document.getElementById('filterPanel');
    const transformPanel = document.getElementById('transformPanel');
    const detailsPanel = document.getElementById('detailsPanel');
    const blurPanel = document.getElementById('blurPanel');

    // Action Panel Controls
    const confirmCurvesBtn = document.getElementById('confirmCurvesBtn');
    const curvesResetBtn = document.getElementById('curvesResetBtn');
    const discardCurvesBtn = document.getElementById('discardCurvesBtn');
    const channelButtons = document.querySelectorAll('.curve-channel-btn');

    /**
     * Opens the Curves Panel and sets up working states
     */
    function openCurvesPanel() {
        // Close all conflicting utility panels seamlessly using display style rules
        if (adjustPanel) adjustPanel.style.display = 'none';
        if (filterPanel) filterPanel.style.display = 'none';
        if (transformPanel) transformPanel.style.display = 'none';
        if (detailsPanel) detailsPanel.style.display = 'none';
        if (blurPanel) blurPanel.style.display = 'none';

        // Deep copy pristine coordinates snapshot BEFORE modifications begin
        if (typeof channelPoints !== 'undefined') {
            fallbackChannelPoints = JSON.parse(JSON.stringify(channelPoints));
        }

        if (curvesPanel) curvesPanel.style.display = 'block';
        CurvesEditor.isOpen = true;

        // Initialize curves engine only ONCE to prevent duplicate point generations
        if (typeof initCurvesEngine === 'function') {
            if (!CurvesEditor.listenersInitialized) {
                initCurvesEngine();
                CurvesEditor.listenersInitialized = true;
            } else {
                // If already initialized, just update the visual path elements without stacking duplicate listeners
                updateCurvesUI();
            }
        }
    }

    /**
     * Closes the Curves Panel interface wrapper cleanly
     */
    function closeCurvesPanel() {
        if (curvesPanel) curvesPanel.style.display = 'none';
        CurvesEditor.isOpen = false;
    }

    // Toggle button click trigger (Handles both opening and closing via single button)
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

    // Channel Selection Click Listeners
    channelButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            channelButtons.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Capture the exact lower-case channel string name identifier
            const channel = e.target.getAttribute('data-channel') || e.target.textContent.toLowerCase().trim();
            CurvesEditor.activeChannel = channel;

            // Visual layout highlight overrides for explicit channel buttons
            channelButtons.forEach(b => { b.style.background = ''; b.style.color = ''; });
            if (channel === 'red') { e.target.style.background = '#7f1d1d'; e.target.style.color = '#fca5a5'; }
            else if (channel === 'green') { e.target.style.background = '#14532d'; e.target.style.color = '#86efac'; }
            else if (channel === 'blue') { e.target.style.background = '#1e3a8a'; e.target.style.color = '#93c5fd'; }

            // Signal engine to update background charts and point path tracks
            if (typeof updateCurvesUI === 'function') {
                updateCurvesUI();
            }
        });
    });

    // Reset Button Trigger Hook
    if (curvesResetBtn) {
        curvesResetBtn.addEventListener('click', () => {
            if (typeof resetCurrentChannel === 'function') {
                resetCurrentChannel();
            }
        });
    }

    // Apply Changes Confirmation Hook
    if (confirmCurvesBtn) {
        confirmCurvesBtn.addEventListener('click', () => {
            console.log("Curves changes permanently applied.");
            closeCurvesPanel();
        });
    }

    // Discard Changes Hook
    if (discardCurvesBtn) {
        discardCurvesBtn.addEventListener('click', () => {
            console.log("Curves changes discarded.");
            
            // 1. Revert active working coordinate arrays back to original state snapshot
            if (fallbackChannelPoints && typeof channelPoints !== 'undefined') {
                channelPoints = JSON.parse(JSON.stringify(fallbackChannelPoints));
            }

            // 2. Erase internally calculated Lookup Tables
            CurvesEditor.curvesLUTs = { rgb: null, red: null, green: null, blue: null };

            // 3. Deactivate global pipeline intercept completely so photo_editor loops ignore curves mapping
            if (window.CurvesManager && window.CurvesManager.activeState) {
                window.CurvesManager.activeState.active = false;
                window.CurvesManager.activeState.lutR = null;
                window.CurvesManager.activeState.lutG = null;
                window.CurvesManager.activeState.lutB = null;
            }

            // 4. Force UI vector paths and tracking lines to redraw to original points
            if (typeof updateCurvesUI === 'function') {
                updateCurvesUI();
            }

            // 5. Fire window pipeline event to immediately force clean canvas re-render
            window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
            
            closeCurvesPanel();
        });
    }
});
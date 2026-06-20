/**
 * Visuals Photo Editor - Color Grading UI Manager
 * Handles UI toggles, panel swapping, tab switching, and local state sync.
 */

let GradingEditor = {
    isOpen: false,
    activeZone: 'shadows', // Default target tab
    // Store independent values for each tonal range
    states: {
        shadows:    { hue: 0, sat: 0 },
        midtones:   { hue: 0, sat: 0 },
        highlights: { hue: 0, sat: 0 }
    },
    // Global parameters
    balance: 0,
    blending: 50
};

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const gradingBtn = document.getElementById('gradingBtn');
    const gradingPanel = document.getElementById('gradingPanel');
    
    // Sliders & Value Text Elements
    const hueInput = document.getElementById('gradingHue');
    const hueVal = document.getElementById('gradingHueVal');
    const satInput = document.getElementById('gradingSat');
    const satVal = document.getElementById('gradingSatVal');
    
    const balanceInput = document.getElementById('gradingBalance');
    const balanceVal = document.getElementById('gradingBalanceVal');
    const blendingInput = document.getElementById('gradingBlending');
    const blendingVal = document.getElementById('gradingBlendingVal');
    
    // Tabs & Buttons
    const tabButtons = document.querySelectorAll('.grading-tab-btn');
    const confirmBtn = document.getElementById('confirmGradingBtn');
    const discardBtn = document.getElementById('discardGradingBtn');

    // Conflicting UI panels to close when opening grading
    const otherPanels = ['adjustPanel', 'filterPanel', 'transformPanel', 'detailsPanel', 'blurPanel', 'curvesPanel', 'mixerPanel'];

    if (!gradingBtn || !gradingPanel) return;

    // 1. Main Toggle: Open / Close Grading Panel
    gradingBtn.addEventListener('click', () => {
        if (GradingEditor.isOpen) {
            closeGradingPanel();
        } else {
            // Close all other tool windows first
            otherPanels.forEach(id => {
                const p = document.getElementById(id);
                if (p) p.style.display = 'none';
            });
            
            gradingPanel.style.display = 'block';
            GradingEditor.isOpen = true;
            
            // Initialize the engine snapshot when opened
            if (typeof initGradingEngine === 'function') {
                initGradingEngine();
            }
            updateUIForZone();
        }
    });

    // 2. Tab Controller: Switching Shadows / Midtones / Highlights
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            tabButtons.forEach(btn => {
                btn.classList.remove('active');
                btn.style.background = 'transparent';
                btn.style.color = '#aaa';
                btn.style.fontWeight = 'normal';
            });

            // Activate clicked tab style
            e.target.classList.add('active');
            e.target.style.background = '#00adb5';
            e.target.style.color = '#fff';
            e.target.style.fontWeight = 'bold';

            // Change current active data state zone
            GradingEditor.activeZone = e.target.getAttribute('data-zone');
            
            // Re-render slider handles matching the stored zone states
            updateUIForZone();
        });
    });

    // Helper to refresh sliders to reflect stored settings of the active tab zone
    function updateUIForZone() {
        const currentData = GradingEditor.states[GradingEditor.activeZone];
        
        hueInput.value = currentData.hue;
        hueVal.textContent = currentData.hue + '°';
        
        satInput.value = currentData.sat;
        satVal.textContent = currentData.sat + '%';
    }

    // 3. Slider Listeners (Dynamic State Hooking)
    hueInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        hueVal.textContent = val + '°';
        GradingEditor.states[GradingEditor.activeZone].hue = val;
        
        requestGradingRender();
    });

    satInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        satVal.textContent = val + '%';
        GradingEditor.states[GradingEditor.activeZone].sat = val;
        
        requestGradingRender();
    });

    balanceInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        balanceVal.textContent = val;
        GradingEditor.balance = val;
        
        requestGradingRender();
    });

    blendingInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        blendingVal.textContent = val + '%';
        GradingEditor.blending = val;
        
        requestGradingRender();
    });

    // 4. Panel Action Handlers
    confirmBtn.addEventListener('click', () => {
        console.log("Color grading changes committed permanently.");
        closeGradingPanel();
    });

    discardBtn.addEventListener('click', () => {
        console.log("Color grading changes discarded.");
        if (typeof revertGradingChanges === 'function') {
            revertGradingChanges();
        }
        closeGradingPanel();
    });

    function closeGradingPanel() {
        gradingPanel.style.display = 'none';
        GradingEditor.isOpen = false;
    }

    // Throttled request trigger sent directly over to the core rendering loop
    function requestGradingRender() {
        if (typeof applyColorGradingEngine === 'function') {
            applyColorGradingEngine();
        }
    }
});
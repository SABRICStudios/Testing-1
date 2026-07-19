/**
 * Visuals Photo Editor - Color Grading UI & Gesture Manager
 * Integrated with Hybrid 2D Color Wheel functionality for Android optimization.
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
    // UI Panels & Toggle Elements
    const gradingBtn = document.getElementById('gradingBtn');
    const gradingPanel = document.getElementById('gradingPanel');
    
    // Core Wheel Elements
    const colorWheel = document.getElementById('colorWheel');
    const wheelPointer = document.getElementById('wheelPointer');
    
    // Hidden Fields & Value Labels (Perfect ID Mapping to Original Elements)
    const hueInput = document.getElementById('gradingHue');
    const hueVal = document.getElementById('gradingHueVal');
    const satInput = document.getElementById('gradingSat');
    const satVal = document.getElementById('gradingSatVal');
    
    const balanceInput = document.getElementById('gradingBalance');
    const balanceVal = document.getElementById('gradingBalanceVal');
    const blendingInput = document.getElementById('gradingBlending');
    const blendingVal = document.getElementById('gradingBlendingVal');
    
    // Action Controls
    const tabButtons = document.querySelectorAll('.grading-tab-btn');
    const confirmBtn = document.getElementById('confirmGradingBtn');
    const discardBtn = document.getElementById('discardGradingBtn');

    // Conflicting panels to auto-close
    const otherPanels = ['adjustPanel', 'filterPanel', 'transformPanel', 'detailsPanel', 'blurPanel', 'curvesPanel', 'mixerPanel'];

    let isDraggingWheel = false;
    let wheelFrameTicking = false;

    if (!gradingBtn || !gradingPanel || !colorWheel || !wheelPointer) return;

    // ================================================
    // 1. CORE WHEEL VECTOR MECHANICS & SCALING
    // ================================================
    function handleWheelMatrix(clientX, clientY) {
        const rect = colorWheel.getBoundingClientRect();
        const radius = rect.width / 2;
        
        // Find touch coordinates relative to the absolute center of the circle
        const centerX = rect.left + radius;
        const centerY = rect.top + radius;
        const x = clientX - centerX;
        const y = clientY - centerY;

        // Angle Calculation (Hue mapped cleanly across a 0° - 360° space)
        let angleRad = Math.atan2(y, x);
        if (angleRad < 0) angleRad += 2 * Math.PI;
        const hue = Math.round((angleRad * 180) / Math.PI);

        // Radial Distance Calculation (Saturation capped between 0% - 100%)
        const distance = Math.sqrt(x * x + y * y);
        const sat = Math.min(100, Math.round((distance / radius) * 100));

        // Sync local states so color_grading_math.js pulls updated variants
        GradingEditor.states[GradingEditor.activeZone].hue = hue;
        GradingEditor.states[GradingEditor.activeZone].sat = sat;

        // Sync backup hidden input tags to remain backward compatible
        if (hueInput) hueInput.value = hue;
        if (satInput) satInput.value = sat;
        
        // Live text readouts updating inside the DOM container element
        if (hueVal) hueVal.textContent = hue + '°';
        if (satVal) satVal.textContent = sat + '%';

        // Physically reposition the absolute tracking reticle pointer element
        updatePointerVisuals(hue, sat, radius);

        // Process downstream graphics pixels loop
        requestGradingRender();
    }

    // Repositions the visual indicator circle using trigonometry translations
    function updatePointerVisuals(hue, sat, radius) {
        if (!radius) radius = colorWheel.getBoundingClientRect().width / 2;
        if (radius === 0) radius = 76; // Safe fallback container radius width check (160px container / 2 - border)

        const angleRad = (hue * Math.PI) / 180;
        const distance = (sat / 100) * radius;

        const pointerX = distance * Math.cos(angleRad);
        const pointerY = distance * Math.sin(angleRad);

        // Employs hardware accelerated GPU transform transitions instead of changing absolute positions
        wheelPointer.style.transform = `translate(calc(-50% + ${pointerX}px), calc(-50% + ${pointerY}px))`;
    }

    // High performance animation frame dispatcher loop intercept
    function onWheelMove(e) {
        if (!isDraggingWheel) return;
        
        const touch = e.touches ? e.touches[0] : e;
        
        if (!wheelFrameTicking) {
            window.requestAnimationFrame(() => {
                handleWheelMatrix(touch.clientX, touch.clientY);
                wheelFrameTicking = false;
            });
            wheelFrameTicking = true;
        }
    }

    // Wire up gesture interactions safely optimized for mobile viewport constraints
    colorWheel.addEventListener('mousedown', (e) => { 
        isDraggingWheel = true; 
        handleWheelMatrix(e.clientX, e.clientY); 
    });
    colorWheel.addEventListener('touchstart', (e) => { 
        isDraggingWheel = true; 
        handleWheelMatrix(e.touches[0].clientX, e.touches[0].clientY); 
    }, { passive: true });

    window.addEventListener('mousemove', onWheelMove);
    window.addEventListener('touchmove', onWheelMove, { passive: true });

    window.addEventListener('mouseup', () => isDraggingWheel = false);
    window.addEventListener('touchend', () => isDraggingWheel = false);


    // ================================================
    // 2. MAIN COUPLING AND STATE RESTORATION
    // ================================================
    
    // Toggle Button Engine Controller
    gradingBtn.addEventListener('click', () => {
        if (GradingEditor.isOpen) {
            closeGradingPanel();
        } else {
            otherPanels.forEach(id => {
                const p = document.getElementById(id);
                if (p) p.style.display = 'none';
            });
            
            gradingPanel.style.display = 'block';
            GradingEditor.isOpen = true;
            
            if (typeof initGradingEngine === 'function') {
                initGradingEngine();
            }
            updateUIForZone();
        }
    });

    // Tab Bar Interceptors
    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            tabButtons.forEach(btn => {
                btn.classList.remove('active');
                btn.style.background = 'transparent';
                btn.style.color = '#aaa';
                btn.style.fontWeight = 'normal';
            });

            e.target.classList.add('active');
            e.target.style.background = '#00adb5';
            e.target.style.color = '#fff';
            e.target.style.fontWeight = 'bold';

            GradingEditor.activeZone = e.target.getAttribute('data-zone');
            
            // Redraw pointer position coordinates matching targeted zones
            updateUIForZone();
        });
    });

    // Sync elements across isolated active luminance zone profiles cleanly
    function updateUIForZone() {
        const currentData = GradingEditor.states[GradingEditor.activeZone];
        
        if (hueInput) hueInput.value = currentData.hue;
        if (hueVal) hueVal.textContent = currentData.hue + '°';
        
        if (satInput) satInput.value = currentData.sat;
        if (satVal) satVal.textContent = currentData.sat + '%';

        // Instantly snap the selector pointer wheel directly back onto its zone coordinates mapping
        updatePointerVisuals(currentData.hue, currentData.sat);
    }

    // Global Sliders Logic Bindings (Balance / Blending)
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

    // Action Triggers
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

    function requestGradingRender() {
        if (typeof applyColorGradingEngine === 'function') {
            applyColorGradingEngine();
        }
    }
});
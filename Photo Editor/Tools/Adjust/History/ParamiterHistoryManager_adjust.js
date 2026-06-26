// ParamiterHistoryManager_adjust.js - Lightweight Configuration State Registry

class ParameterHistoryManager {
    constructor() {
        // Local temporary state registry tracking scalar properties
        this.values = {
            exposure: 0.0,
            brightness: 0,
            contrast: 0,
            saturation: 0,
            temperature: 0, // Added for hardware-accelerated rendering
            tint: 0         // Added for hardware-accelerated rendering
        };
        this.sessionCache = {};
    }

/**
     * Updates an internal scalar parameter dynamically during a live slider interaction
     */
    updateValue(toolKey, value) {
        if (this.values.hasOwnProperty(toolKey)) {
            // exposure uses float decimals, other sliders use standard absolute integers
            const parsedValue = toolKey === 'exposure' ? parseFloat(value) : parseInt(value, 10);
            this.values[toolKey] = parsedValue;
            
            // LINK TO MASTER: Feed the live update into the central timeline manager pipeline
            if (window.HistoryManager && typeof window.HistoryManager.updateValue === 'function') {
                window.HistoryManager.updateValue(toolKey, parsedValue);
            } else {
                this.broadcastRealtimeChange();
            }
        }
    }

    /**
     * Backs up current numbers before opening a slider tool view pane
     */
    startSession() {
        this.sessionCache = { ...this.values };
    }

    /**
     * Flushes temporary slider adjustments back to pre-session cached limits
     */
    discardSession() {
        // Revert data back to our cached state snapshot
        this.values = { ...this.sessionCache };
        // Cleanly snap the HTML UI elements back to position
        this.syncDOM();
        // Force photo_editor.js to redraw the reverted state
        this.broadcastRealtimeChange();
    }

    /**
     * Bundles finalized slider values up to the master History Manager control tower
     */
    confirmSession(toolLabel) {
        if (window.HistoryManager) {
            // Packages the configuration object cleanly for the master timeline stack
            window.HistoryManager.commitChange(toolLabel, {
                type: 'scalar', // Changed from 'baseline' to match the system structure
                values: { ...this.values }
            });
        } else {
            console.error("Master HistoryManager is missing. Cannot register scalar configuration step.");
        }
    }

    /**
     * Synchronizes local state tracking arrays with data pulled down from a restored step
     */
    syncState(restoredScalarValues) {
        this.values = { ...restoredScalarValues };
        this.syncDOM();
    }

    /**
     * Standardized UI syncing operation - keeps HTML DOM slider indicators mirroring current values
     */
    /**
     * Standardized UI syncing operation - keeps HTML DOM slider indicators mirroring current values
     */
    syncDOM() {
        const sliders = ['exposure', 'brightness', 'contrast', 'saturation', 'temperature', 'tint'];
        sliders.forEach(key => {
            // Fix: Map 'temperature' key to the actual DOM id 'tempSlider'
            const domId = key === 'temperature' ? 'tempSlider' : `${key}Slider`;
            const element = document.getElementById(domId);
            
            if (element) {
                element.value = this.values[key];
            }
        });
    }

    /**
     * Dispatches a lightweight system notification to keep photo_editor.js updated
     */
    broadcastRealtimeChange() {
        window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
    }
}

// Bind to the global window space under your chosen name
window.ParameterHistory = new ParameterHistoryManager();
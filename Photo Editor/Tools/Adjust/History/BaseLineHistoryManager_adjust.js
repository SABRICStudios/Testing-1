/**
 * BaseLineHistoryManager.js
 * Optimized sub-manager tracking live interactive updates and visual adjustments 
 * for baseline tools: Highlights, Shadows, Clarity, Sharpen, Vibrance, Vignette.
 */
class BaseLineHistoryManager {
    constructor(initialValues = {}) {
        this.defaultValues = {
            highlights: 0,
            shadows: 0,
            clarity: 0,
            sharpen: 0,
            vibrance: 0,
            vignette: 0,
            ...initialValues
        };

        // Track committed checkpoint state
        this.currentState = { ...this.defaultValues };
        
        // Transient tracking bridge for high-speed mobile slider scrubbing 
        this.liveValues = { ...this.defaultValues };
    }

    /**
     * Updates an individual parameter dynamically during a live slider drag interaction.
     * Keeps interactions isolated in liveValues to avoid dirtying master states prematurely.
     */
    updateLiveValue(toolKey, value) {
        if (this.liveValues.hasOwnProperty(toolKey)) {
            this.liveValues[toolKey] = parseInt(value, 10);
            
            // Explicitly notify the master HistoryManager to maintain global parameters
            if (window.HistoryManager && window.HistoryManager.historyStack[window.HistoryManager.currentIndex]) {
                const activeState = window.HistoryManager.historyStack[window.HistoryManager.currentIndex].state;
                if (activeState.baseline) {
                    activeState.baseline[toolKey] = this.liveValues[toolKey];
                }
            }

            // Fire global rendering loop event trigger
            window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
        }
    }

    /**
     * Accessor method serving current parameters up to the canvas pipeline filter loop.
     * @return {Object}
     */
    getActiveState() {
        return {
            toolValues: { ...this.liveValues },
            currentState: { ...this.currentState }
        };
    }

    /**
     * Synchronizes internal baseline states when rolling backward/forward on the master timeline
     */
    syncState(restoredBaselineValues) {
        const validatedValues = restoredBaselineValues || { ...this.defaultValues };
        this.currentState = { ...this.defaultValues, ...validatedValues };
        this.liveValues = { ...this.currentState };
        this.syncDOM();
    }

    /**
     * Synchronizes HTML DOM slider track inputs to visually match internal data values
     */
    syncDOM() {
        const tools = ['highlights', 'shadows', 'clarity', 'sharpen', 'vibrance', 'vignette'];
        tools.forEach(key => {
            const element = document.getElementById(`${key}Slider`);
            if (element) {
                element.value = this.currentState[key] !== undefined ? this.currentState[key] : this.defaultValues[key];
            }
        });
    }

    /**
     * Returns tracking parameters back to zero states safely
     */
    reset() {
        this.currentState = { ...this.defaultValues };
        this.liveValues = { ...this.defaultValues };
        this.syncDOM();
        return this.getActiveState();
    }
}

// Bind instance to the global window environment tracking bridge
window.BaselineHistory = new BaseLineHistoryManager();
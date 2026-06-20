/**
 * Visuals Photo Editor - Filter History Sub-Manager (Upgraded Version)
 * Manages isolated tracking layers for active image lookup filter profiles.
 */
class FilterHistoryManager {
    constructor() {
        // Enforce rigid flat primitives to prevent garbage collection sweeps
        this.currentState = {
            type: 'none',
            intensity: 100
        };
    }

    /**
     * Synchronizes internal tracking variables with an external snapshot.
     */
    syncState(incomingFilterState) {
        if (!incomingFilterState) {
            this.currentState.type = 'none';
            this.currentState.intensity = 100;
            return;
        }
        
        // Mutate existing memory locations directly instead of replacing object references
        this.currentState.type = incomingFilterState.type || 'none';
        this.currentState.intensity = typeof incomingFilterState.intensity === 'number' 
            ? incomingFilterState.intensity 
            : 100;
    }

    /**
     * Mutates values cleanly on input scrubbing without regenerating nested layout trees.
     */
    updateLivePreviewValues(filterType, intensityValue) {
        this.currentState.type = filterType;
        this.currentState.intensity = Math.min(100, Math.max(0, parseInt(intensityValue, 10) || 0));
    }

    /**
     * Returns a copy replica of the running profile matrix configuration.
     */
    getCurrentState() {
        return {
            type: this.currentState.type,
            intensity: this.currentState.intensity
        };
    }

    /**
     * Pushes the running live state config out to the main historic timeline ledger.
     */
    commitToMaster(label = "Apply Filter") {
        if (!window.HistoryManager) {
            console.error("Global 'HistoryManager' wrapper instance is inaccessible across scope windows.");
            return;
        }

        window.HistoryManager.commitChange(label, {
            type: 'filter',
            values: this.getCurrentState()
        });
    }
}

// Instantiate explicitly using the standard expected global namespace key
window.BaselineFilterHistory = new FilterHistoryManager();
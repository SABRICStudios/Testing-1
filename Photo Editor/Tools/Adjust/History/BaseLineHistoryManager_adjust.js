/**
 * BaseLineHistoryManager.js
 * Manages the history states (Undo/Redo) via metadata coefficients for complex pixel manipulation tools:
 * Highlights, Shadows, Clarity, Sharpen, Vibrance, Vignette.
 */
class BaseLineHistoryManager {
    constructor(initialValues = {}) {
        // Define default baseline values for the 6 complex tools
        this.defaultValues = {
            highlights: 0,
            shadows: 0,
            clarity: 0,
            sharpen: 0,
            vibrance: 0,
            vignette: 0,
            ...initialValues
        };

        // History Stacks
        this.undoStack = [];
        this.redoStack = [];

        // Track the current live active state configuration
        this.currentState = { ...this.defaultValues };
        
        // --- NEW: Dynamic real-time live preview state bridge ---
        this.liveValues = { ...this.defaultValues };

        // Initialize history with the starting pristine baseline configuration
        this._pushRawSnapshot({ ...this.currentState }, "initial_baseline");
    }

    /**
     * Updates an internal parameter dynamically during a live slider interaction
     * This triggers real-time global canvas previews without polluting undo/redo history.
     */
    updateLiveValue(toolKey, value) {
        if (this.liveValues.hasOwnProperty(toolKey)) {
            this.liveValues[toolKey] = parseInt(value, 10);
            
            // Fire the global custom event to force photo_editor.js to update live
            window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
        }
    }

    /**
     * Public method to commit a new parameter state adjustment.
     * Automatically merges with existing parameter values and clears the redo chain.
     */
    pushState(newValues, triggerTool = "unknown") {
        // Merge updates with current state to ensure all parameters persist across edits
        this.currentState = { ...this.currentState, ...newValues };
        
        // Keep the live values synchronized with the latest committed milestone
        this.liveValues = { ...this.currentState };

        this.redoStack = []; // Clear redo stack on structural mutation entries
        this._pushRawSnapshot({ ...this.currentState }, triggerTool);
        
        return this.getActiveState();
    }

    _pushRawSnapshot(stateCopy, label) {
        this.undoStack.push({
            label: label,
            values: JSON.parse(JSON.stringify(stateCopy))
        });
    }

    undo() {
        if (this.undoStack.length <= 1) return this.getActiveState();

        const activeState = this.undoStack.pop();
        this.redoStack.push(activeState);

        const previousState = this.undoStack[this.undoStack.length - 1];
        this.currentState = { ...previousState.values };
        this.liveValues = { ...this.currentState };

        return this.getActiveState();
    }

    redo() {
        if (this.redoStack.length === 0) return this.getActiveState();

        const restoredState = this.redoStack.pop();
        this.undoStack.push(restoredState);
        
        this.currentState = { ...restoredState.values };
        this.liveValues = { ...this.currentState };

        return this.getActiveState();
    }

    /**
     * Accessor method returning compiled state fields for pipeline ingestion.
     * Modified to serve active scrubbing parameters dynamically.
     * @return {Object}
     */
    getActiveState() {
        return {
            toolValues: { ...this.liveValues }, // FIXED: Feed active slider scrubbing context safely
            canUndo: this.undoStack.length > 1,
            canRedo: this.redoStack.length > 0
        };
    }

    /**
     * Synchronizes local baseline settings with data pulled down from master timeline changes
     */
    syncState(restoredBaselineValues) {
        this.currentState = { ...restoredBaselineValues };
        this.liveValues = { ...this.currentState };
        this.syncDOM();
    }

    /**
     * Keeps HTML DOM slider UI elements accurately synchronized mirroring back-end memory metrics
     */
    syncDOM() {
        const tools = ['highlights', 'shadows', 'clarity', 'sharpen', 'vibrance', 'vignette'];
        tools.forEach(key => {
            const element = document.getElementById(`${key}Slider`);
            if (element) {
                element.value = this.currentState[key];
            }
        });
    }

    /**
     * Resets all manager tracking properties back to zero values.
     */
    reset() {
        this.undoStack = [];
        this.redoStack = [];
        this.currentState = { ...this.defaultValues };
        this.liveValues = { ...this.defaultValues };
        this._pushRawSnapshot({ ...this.currentState }, "reset");
        return this.getActiveState();
    }
}

// Bind instance to the global window environment tracking bridge
window.BaselineHistory = new BaseLineHistoryManager();
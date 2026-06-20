// history_manager.js - Central Orchestrator & App Timeline Manager

class MasterHistoryManager {
    constructor(maxHistory = 20) {
        this.maxHistory = maxHistory;
        this.historyStack = [];
        this.currentIndex = -1;

        // Factory defaults mapping all parameters plus structural transform parameters
       this.defaultState = {
            scalar: { exposure: 0.0, brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0 },
            baseline: { highlights: 0, shadows: 0, clarity: 0, sharpen: 0, vibrance: 0, vignette: 0 },
            transform: { width: 0, height: 0, rotation: 0 },
            
            // Default structural tracking configuration for the filter engine tool
            filter: {
                type: 'none',
                intensity: 100
            }
        };

        // Seed initial pristine state track
        this.commitInitialState();
    }

    commitInitialState() {
        const initialSnapshot = {
            label: "Original Image",
            state: JSON.parse(JSON.stringify(this.defaultState))
        };
        this.historyStack.push(initialSnapshot);
        this.currentIndex = 0;
    }

    /**
     * Retrieves a cloned snapshot representation tracking every system variable at the current pointer index
     */
    getCurrentParameters() {
        if (this.currentIndex >= 0 && this.currentIndex < this.historyStack.length) {
            return JSON.parse(JSON.stringify(this.historyStack[this.currentIndex].state));
        }
        return JSON.parse(JSON.stringify(this.defaultState));
    }

    /**
     * Updates an active property level dynamically without creating redundant historical log milestones
     */
    updateValue(toolKey, value) {
        if (this.currentIndex < 0) return;
        
        // Safety copy to prevent direct uncommitted history stack mutations
        const currentState = this.historyStack[this.currentIndex].state;

        // Route complex baseline properties safely
        if (['highlights', 'shadows', 'clarity', 'sharpen', 'vibrance', 'vignette'].includes(toolKey)) {
            if (!currentState.baseline) currentState.baseline = {};
            currentState.baseline[toolKey] = parseInt(value, 10);
            this.broadcastChange();
        } 
        // Route exposure / scalars cleanly
        else {
            const parsedValue = toolKey === 'exposure' ? parseFloat(value) : parseInt(value, 10);
            if (!currentState.scalar) currentState.scalar = {};
            currentState.scalar[toolKey] = parsedValue;
            this.broadcastChange();
        }
    }

    /**
     * Commits a definitive history snapshot entry log to the timeline track array stack
     */
    commitChange(toolLabel, payload) {
        if (!payload || !payload.type) return;

        if (this.currentIndex < this.historyStack.length - 1) {
            this.historyStack = this.historyStack.slice(0, this.currentIndex + 1);
        }

        const baseState = JSON.parse(JSON.stringify(this.historyStack[this.currentIndex].state));

        if (payload.type === 'scalar') {
            baseState.scalar = { ...baseState.scalar, ...payload.values };
        } else if (payload.type === 'baseline') {
            // FIXED: Support both payload models (.activeToolValues from parameter manager and standard baseline .values)
            if (payload.activeToolValues) {
                baseState.scalar = { ...baseState.scalar, ...payload.activeToolValues };
            } else {
                baseState.baseline = { ...baseState.baseline, ...payload.values };
            }
        } else if (payload.type === 'transform') {
            baseState.transform = { ...baseState.transform, ...payload.values };
        } else if (payload.type === 'filter') {
            baseState.filter = { ...baseState.filter, ...payload.values };
        }

        this.historyStack.push({
            label: toolLabel,
            state: baseState
        });

        if (this.historyStack.length > this.maxHistory) {
            this.historyStack.shift();
        } else {
            this.currentIndex++;
        }

        this.syncSubManagersToCurrentCheckpoint();
        this.broadcastChange();
    }

    undo() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.syncSubManagersToCurrentCheckpoint();
            this.broadcastChange();
        }
    }

    redo() {
        if (this.currentIndex < this.historyStack.length - 1) {
            this.currentIndex++;
            this.syncSubManagersToCurrentCheckpoint();
            this.broadcastChange();
        }
    }

    // --- TRANSIENT MODAL TEMPORARY DISCARD SESSIONS BACKUPS ---
    _sessionBackup = null;

    backupActiveSessionState() {
        this._sessionBackup = JSON.parse(JSON.stringify(this.historyStack[this.currentIndex].state));
    }

    revertActiveSessionState() {
        if (this._sessionBackup) {
            this.historyStack[this.currentIndex].state = this._sessionBackup;
            
            // Revert sub-manager cache tracking vectors safely
            if (window.BaselineHistory) {
                window.BaselineHistory.liveValues = { ...this._sessionBackup.baseline };
                window.BaselineHistory.currentState = { ...this._sessionBackup.baseline };
            }

            this._sessionBackup = null;
            this.broadcastChange();
        }
    }

    clearToDefaultStates() {
        this.historyStack = [];
        this.commitInitialState();
        this.syncSubManagersToCurrentCheckpoint();
    }

    syncSubManagersToCurrentCheckpoint() {
        const currentSnapshot = this.getCurrentParameters();
        
        // Sync Adjust / Scalar values down to its sub-manager on undo/redo
        if (window.ParameterHistory && typeof window.ParameterHistory.syncState === 'function') {
            window.ParameterHistory.syncState(currentSnapshot.scalar);
        }

        if (window.BaselineHistory && typeof window.BaselineHistory.syncState === 'function') {
            window.BaselineHistory.syncState(currentSnapshot.baseline);
        }
        
        if (window.BaselineFilterHistory && typeof window.BaselineFilterHistory.syncState === 'function') {
            window.BaselineFilterHistory.syncState(currentSnapshot.filter);
        }
    }

    broadcastChange() {
        window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
    }
}

// --- INITIALIZE MASTER INSTANCES & ALIAS GLOBAL BRIDGES ---
window.HistoryManager = new MasterHistoryManager(20);
window.EditorHistory = window.HistoryManager;

// Shared Desktop Keyboard Listeners
window.addEventListener('keydown', (e) => {
    const isModifier = e.ctrlKey || e.metaKey;
    if (isModifier && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        window.HistoryManager.undo();
    }
    if (isModifier && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        window.HistoryManager.redo();
    }
});

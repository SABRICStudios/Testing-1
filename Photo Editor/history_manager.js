// history_manager_2.js - Central Orchestrator & App Timeline Manager

class MasterHistoryManager {
    constructor(maxHistory = 20) {
        this.maxHistory = maxHistory;
        this.historyStack = [];
        this.currentIndex = -1;

        // Factory defaults mapping all parameters plus structural transform and selection parameters
        this.defaultState = {
            scalar: { exposure: 0.0, brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0 },
            baseline: { highlights: 0, shadows: 0, clarity: 0, sharpen: 0, vibrance: 0, vignette: 0 },
            selection: {
                global: {
                    scalar: { exposure: 0.0, brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0 },
                    baseline: { highlights: 0, shadows: 0, clarity: 0, sharpen: 0, vibrance: 0, vignette: 0 }
                },
                local: {
                    scalar: { exposure: 0.0, brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0 },
                    baseline: { highlights: 0, shadows: 0, clarity: 0, sharpen: 0, vibrance: 0, vignette: 0 }
                }
            },
            transform: { width: null, height: null, rotation: 0 },
            filter: {
                type: 'none',
                intensity: 100
            },
            details: {
                sharpenAmount: 0,
                sharpenRadius: 1.0,
                sharpenThreshold: 25,
                sharpenMasking: 0,
                noiseLuminance: 0,
                noiseLumDetail: 50,
                noiseColor: 0,
                noiseColorDetail: 50
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
     * Updates an active property level dynamically while correctly routing local vs global selection contexts
     */
    updateValue(toolKey, value) {
        if (this.currentIndex < 0) return;

        const currentState = this.historyStack[this.currentIndex].state;
        const isSelectionActive = !!(window.activeSelectionMask && window.activeSelectionMask.data);
        const parsedValue = toolKey === 'exposure' ? parseFloat(value) : parseInt(value, 10);

        // Update active SelectionAdjustmentState runtime memory mirror if initialized
        if (window.SelectionAdjustmentState) {
            const activeGroup = isSelectionActive ? window.SelectionAdjustmentState.local : window.SelectionAdjustmentState.global;
            if (['highlights', 'shadows', 'clarity', 'sharpen', 'vibrance', 'vignette'].includes(toolKey)) {
                if (!activeGroup.baseline) activeGroup.baseline = {};
                activeGroup.baseline[toolKey] = parsedValue;
            } else {
                if (!activeGroup.scalar) activeGroup.scalar = {};
                activeGroup.scalar[toolKey] = parsedValue;
            }
        }

        // Route updates into current timeline history snapshot
        if (isSelectionActive) {
            if (!currentState.selection) {
                currentState.selection = JSON.parse(JSON.stringify(this.defaultState.selection));
            }
            const activeGroup = currentState.selection.local;
            if (['highlights', 'shadows', 'clarity', 'sharpen', 'vibrance', 'vignette'].includes(toolKey)) {
                if (!activeGroup.baseline) activeGroup.baseline = {};
                activeGroup.baseline[toolKey] = parsedValue;
            } else {
                if (!activeGroup.scalar) activeGroup.scalar = {};
                activeGroup.scalar[toolKey] = parsedValue;
            }
        } else {
            if (['highlights', 'shadows', 'clarity', 'sharpen', 'vibrance', 'vignette'].includes(toolKey)) {
                if (!currentState.baseline) currentState.baseline = {};
                currentState.baseline[toolKey] = parsedValue;
            } else {
                if (!currentState.scalar) currentState.scalar = {};
                currentState.scalar[toolKey] = parsedValue;
            }

            // Keep global selection state in sync with base parameters
            if (!currentState.selection) {
                currentState.selection = JSON.parse(JSON.stringify(this.defaultState.selection));
            }
            if (['highlights', 'shadows', 'clarity', 'sharpen', 'vibrance', 'vignette'].includes(toolKey)) {
                currentState.selection.global.baseline[toolKey] = parsedValue;
            } else {
                currentState.selection.global.scalar[toolKey] = parsedValue;
            }
        }

        this.broadcastChange();
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
            if (baseState.selection && baseState.selection.global) {
                baseState.selection.global.scalar = { ...baseState.selection.global.scalar, ...payload.values };
            }
        } else if (payload.type === 'baseline') {
            if (payload.activeToolValues) {
                baseState.scalar = { ...baseState.scalar, ...payload.activeToolValues };
                if (baseState.selection && baseState.selection.global) {
                    baseState.selection.global.scalar = { ...baseState.selection.global.scalar, ...payload.activeToolValues };
                }
            } else {
                baseState.baseline = { ...baseState.baseline, ...payload.values };
                if (baseState.selection && baseState.selection.global) {
                    baseState.selection.global.baseline = { ...baseState.selection.global.baseline, ...payload.values };
                }
            }
        } else if (payload.type === 'selection') {
            baseState.selection = JSON.parse(JSON.stringify(payload.values));
        } else if (payload.type === 'transform') {
            baseState.transform = { ...baseState.transform, ...payload.values };
        } else if (payload.type === 'filter') {
            baseState.filter = { ...baseState.filter, ...payload.values };
        } else if (payload.type === 'details') {
            baseState.details = { ...baseState.details, ...payload.values };
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
        this._sessionBackup = {
            state: JSON.parse(JSON.stringify(this.historyStack[this.currentIndex].state)),
            selectionState: window.SelectionAdjustmentState ? JSON.parse(JSON.stringify(window.SelectionAdjustmentState)) : null
        };
    }

    revertActiveSessionState() {
        if (this._sessionBackup) {
            this.historyStack[this.currentIndex].state = JSON.parse(JSON.stringify(this._sessionBackup.state));

            if (this._sessionBackup.selectionState && window.SelectionAdjustmentState) {
                window.SelectionAdjustmentState = JSON.parse(JSON.stringify(this._sessionBackup.selectionState));
            }

            if (window.BaselineHistory) {
                window.BaselineHistory.liveValues = { ...this._sessionBackup.state.baseline };
                window.BaselineHistory.currentState = { ...this._sessionBackup.state.baseline };
            }

            this._sessionBackup = null;
            this.syncSubManagersToCurrentCheckpoint();
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

        // Sync Selection State on undo/redo or history snapshot shifts
        if (currentSnapshot.selection) {
            window.SelectionAdjustmentState = JSON.parse(JSON.stringify(currentSnapshot.selection));
            if (typeof window.syncAdjustToolUI === 'function') {
                const isSelectionActive = !!(window.activeSelectionMask && window.activeSelectionMask.data);
                window.syncAdjustToolUI(isSelectionActive);
            }
        }

        if (currentSnapshot.details && window.DetailsManager) {
            window.DetailsManager.activeState = { ...currentSnapshot.details };
            if (typeof window.DetailsManager.syncUIFromState === 'function') {
                window.DetailsManager.syncUIFromState();
            }
        }

        if (currentSnapshot.transform && currentSnapshot.transform.width) {
            if (window.imgState) {
                window.imgState.width = currentSnapshot.transform.width;
                window.imgState.height = currentSnapshot.transform.height;
                window.imgState.rotation = currentSnapshot.transform.rotation || 0;
            }
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
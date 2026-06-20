// Tools/Crop/crop_history_connector.js

// 1. Extend the MasterHistoryManager default state safely without overriding the file
if (window.HistoryManager) {
    // Inject clean default crop state parameters into the global blueprint
    window.HistoryManager.defaultState.crop = {
        x: 0,
        y: 0,
        width: 1.0,  // Stored as a normalized percentage multiplier (0.0 - 1.0)
        height: 1.0  // Stored as a normalized percentage multiplier (0.0 - 1.0)
    };

    // Update the very first "Original Image" checkpoint array entry to include the default crop state
    if (window.HistoryManager.historyStack && window.HistoryManager.historyStack[0]) {
        window.HistoryManager.historyStack[0].state.crop = { x: 0, y: 0, width: 1.0, height: 1.0 };
    }
    
    /**
     * Public method to push a new Crop event state cleanly onto the Master History Stack
     */
    window.HistoryManager.commitCropAction = function(label, normalizedCropBox) {
        // Build a deep clone copy of the current scalar/baseline adjustments state
        const currentParams = this.getCurrentParameters();
        
        const newSnapshot = {
            label: label || "Crop Image",
            state: {
                scalar: JSON.parse(JSON.stringify(currentParams.scalar || this.defaultState.scalar)),
                baseline: JSON.parse(JSON.stringify(currentParams.baseline || this.defaultState.baseline)),
                crop: {
                    x: normalizedCropBox.x,
                    y: normalizedCropBox.y,
                    width: normalizedCropBox.width,
                    height: normalizedCropBox.height
                }
            }
        };

        // Clip any existing forward redo paths if we are editing from midway in the stack
        if (this.currentIndex < this.historyStack.length - 1) {
            this.historyStack = this.historyStack.slice(0, this.currentIndex + 1);
        }

        // Enforce maximum stack constraints limit
        if (this.historyStack.length >= this.maxHistory) {
            this.historyStack.shift();
            this.currentIndex--;
        }

        this.historyStack.push(newSnapshot);
        this.currentIndex++;

        // Broadcast downstream events to force photo_editor.js to execute a global canvas re-render
        this.broadcastChange();
    };

    /**
     * Read helper to pull out the crop parameters active at the current history checkpoint index
     */
    window.HistoryManager.getCurrentCropParameters = function() {
        if (this.currentIndex === -1 || !this.historyStack[this.currentIndex]) {
            return { x: 0, y: 0, width: 1.0, height: 1.0 };
        }
        return this.historyStack[this.currentIndex].state.crop || { x: 0, y: 0, width: 1.0, height: 1.0 };
    };
}
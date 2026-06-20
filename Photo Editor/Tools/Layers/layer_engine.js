/**
 * Visuals Photo Editor - Layers Vector Engine
 * Manages offscreen surface maps and alpha blend canvas compositing loops.
 */

let mainCanvasElement = null;
let mainCanvasContext = null;

// Object tracking offscreen rendering canvases index states
let layerCanvasRegistry = {};

/**
 * Boots core links and registers historical snapshots onto base layers track
 */
function initLayersEngine() {
    mainCanvasElement = document.getElementById('editorCanvas');
    if (!mainCanvasElement) return;
    
    mainCanvasContext = mainCanvasElement.getContext('2d');

    // Create the background layer canvas tracks if it doesn't exist yet
    if (!layerCanvasRegistry[1]) {
        createEngineLayerTrack(1);
        
        // Populate base tracking surface with current image viewport contents
        let offscreenCtx = layerCanvasRegistry[1].getContext('2d');
        offscreenCtx.drawImage(mainCanvasElement, 0, 0);
    }
}

/**
 * Allocates standalone off-screen canvas instances for newly instantiated elements
 */
function createEngineLayerTrack(layerId) {
    let offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = mainCanvasElement.width;
    offscreenCanvas.height = mainCanvasElement.height;
    
    layerCanvasRegistry[layerId] = offscreenCanvas;
    
    // If it's a decorative mock text element added, drop some temporary text geometry down
    if (layerId !== 1 && LayersEditor.layers.find(l => l.id === layerId)?.type !== 'image') {
        let ctx = offscreenCanvas.getContext('2d');
        ctx.font = 'bold 40px sans-serif';
        ctx.fillStyle = '#00adb5';
        ctx.fillText("Visuals Editor", 50, 100);
    }
}

/**
 * Loops and flattens all visible elements down into the screen space buffer
 */
function drawLayersCompositeLoop() {
    if (!mainCanvasContext || !mainCanvasElement) return;

    // Clear main UI drawing surface framework 
    mainCanvasContext.clearRect(0, 0, mainCanvasElement.width, mainCanvasElement.height);

    // Read the array backwards (from bottom to top index) to stack correctly
    for (let i = LayersEditor.layers.length - 1; i >= 0; i--) {
        let layerConfig = LayersEditor.layers[i];
        let structuralCanvas = layerCanvasRegistry[layerConfig.id];

        if (structuralCanvas && layerConfig.visible) {
            // Modify surface globally to map user configuration opacity properties cleanly
            mainCanvasContext.globalAlpha = layerConfig.opacity / 100;
            
            // Stamp content overlay onto the workspace pipeline
            mainCanvasContext.drawImage(structuralCanvas, 0, 0);
        }
    }

    // Restore primary alpha constraint parameter state back to defaults
    mainCanvasContext.globalAlpha = 1.0;
}
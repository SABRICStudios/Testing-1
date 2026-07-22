/**
 * Visuals Photo Editor - Layers Vector Engine
 * Manages offscreen surface maps and alpha blend canvas compositing loops.
 */

let mainCanvasElement = null;
let mainCanvasContext = null;

// Object tracking offscreen rendering canvases index states
window.layerCanvasRegistry = {};

/**
 * Boots core links and registers historical snapshots onto base layers track
 */
window.initLayersEngine = function() {
    mainCanvasElement = document.getElementById('editorCanvas');
    if (!mainCanvasElement) return;
    
    mainCanvasContext = mainCanvasElement.getContext('2d');

    // Create background layer canvas track if missing
    if (!window.layerCanvasRegistry[1]) {
        window.createEngineLayerTrack(1);
    }
    
    // Sync base layer offscreen canvas with processed image state
    if (window.imgState && window.imgState.imageXCanvas) {
        let baseOffscreen = window.layerCanvasRegistry[1];
        
        if (baseOffscreen.width !== window.imgState.imageXCanvas.width || 
            baseOffscreen.height !== window.imgState.imageXCanvas.height) {
            baseOffscreen.width = window.imgState.imageXCanvas.width;
            baseOffscreen.height = window.imgState.imageXCanvas.height;
        }
        
        let offscreenCtx = baseOffscreen.getContext('2d');
        offscreenCtx.clearRect(0, 0, baseOffscreen.width, baseOffscreen.height);
        offscreenCtx.drawImage(window.imgState.imageXCanvas, 0, 0);
    }
};

/**
 * Allocates standalone off-screen canvas instances for newly instantiated elements
 */
window.createEngineLayerTrack = function(layerId) {
    let offscreenCanvas = document.createElement('canvas');
    
    // Prioritize high-resolution source image dimensions
    const targetWidth = window.imgState?.imageXCanvas?.width || window.imgState?.width || mainCanvasElement?.width || 800;
    const targetHeight = window.imgState?.imageXCanvas?.height || window.imgState?.height || mainCanvasElement?.height || 600;
    
    offscreenCanvas.width = targetWidth;
    offscreenCanvas.height = targetHeight;
    
    window.layerCanvasRegistry[layerId] = offscreenCanvas;
    
    // Dummy content layer generation for text overlays
    if (layerId !== 1 && window.LayersEditor?.layers) {
        const layerConfig = window.LayersEditor.layers.find(l => l.id === layerId);
        if (layerConfig && layerConfig.type !== 'image') {
            let ctx = offscreenCanvas.getContext('2d');
            ctx.font = 'bold 42px sans-serif';
            ctx.fillStyle = '#00adb5';
            ctx.fillText("Visuals Overlay", 60, 120);
        }
    }
};

/**
 * Frees memory buffer when a layer gets deleted
 */
window.removeEngineLayerTrack = function(layerId) {
    if (window.layerCanvasRegistry[layerId]) {
        const ctx = window.layerCanvasRegistry[layerId].getContext('2d');
        ctx.clearRect(0, 0, window.layerCanvasRegistry[layerId].width, window.layerCanvasRegistry[layerId].height);
        delete window.layerCanvasRegistry[layerId];
    }
};

/**
 * Composites offscreen layers from bottom to top onto editor display canvas
 */
window.drawLayersCompositeLoop = function() {
    if (!mainCanvasContext || !mainCanvasElement || !window.LayersEditor) return;

    const layers = window.LayersEditor.layers;
    const state = window.imgState || {};
    
    // Fall back to target canvas dimensions if imgState positioning isn't set yet
    const destX = state.x !== undefined ? state.x : 0;
    const destY = state.y !== undefined ? state.y : 0;
    const destW = state.width || mainCanvasElement.width;
    const destH = state.height || mainCanvasElement.height;

    // Read backwards (array index length-1 up to index 0) so background draws first
    for (let i = layers.length - 1; i >= 0; i--) {
        let layerConfig = layers[i];
        let structuralCanvas = window.layerCanvasRegistry[layerConfig.id];

        if (structuralCanvas && layerConfig.visible) {
            mainCanvasContext.save();
            mainCanvasContext.globalAlpha = layerConfig.opacity / 100;
            
            mainCanvasContext.drawImage(
                structuralCanvas, 
                0, 0, structuralCanvas.width, structuralCanvas.height,
                destX, destY, destW, destH
            );
            
            mainCanvasContext.restore();
        }
    }
};
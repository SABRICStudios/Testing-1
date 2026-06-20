/**
 * Visuals Photo Editor - Mixer Brush Painting Engine
 */

let isPaintingWithMixer = false;
let mixerCanvasCtx = null;
let mixerMainCanvas = null;
let brushReservoirColor = null; 
let lastMousePos = { x: 0, y: 0 }; // Tracks movement paths to prevent dotted spacing

function initMixerEngine() {
    // Target the core pipeline layer canvas instead of the presentation canvas element
    if (window.imgState && window.imgState.imageXCanvas) {
        mixerMainCanvas = window.imgState.imageXCanvas;
    } else {
        mixerMainCanvas = document.getElementById('editorCanvas');
    }
    
    if (!mixerMainCanvas) return;
    mixerCanvasCtx = mixerMainCanvas.getContext('2d');
    
    // Initial color reservoir load (Teal default accent)
    brushReservoirColor = { r: 0, g: 173, b: 181 };

    // Attach mouse listeners directly onto the working drawing surface
    const displayCanvas = document.getElementById('editorCanvas');
    if (displayCanvas) {
        displayCanvas.style.cursor = 'crosshair'; // Better visual cue for painting
        displayCanvas.addEventListener('mousedown', startMixerStroke);
        displayCanvas.addEventListener('mousemove', paintMixerStroke);
    }
    window.addEventListener('mouseup', endMixerStroke);
}

function shutdownMixerEngine() {
    // Inside shutdownMixerEngine() in mixer_engine.js
        const displayCanvas = document.getElementById('editorCanvas');
        if (displayCanvas) {
            displayCanvas.style.cursor = 'default';
        }
    window.removeEventListener('mouseup', endMixerStroke);
}

function getCanvasMouseLocation(e) {
    const displayCanvas = document.getElementById('editorCanvas');
    if (!displayCanvas || !mixerMainCanvas) return { x: 0, y: 0 };
    
    const rect = displayCanvas.getBoundingClientRect();
    
    // Convert coordinate maps matching original image proportions accurately
    return {
        x: (e.clientX - rect.left) * (mixerMainCanvas.width / rect.width),
        y: (e.clientY - rect.top) * (mixerMainCanvas.height / rect.height)
    };
}

function startMixerStroke(e) {
    if (!MixerEditor || !MixerEditor.isOpen) return;
    isPaintingWithMixer = true;
    
    const loc = getCanvasMouseLocation(e);
    lastMousePos = loc;

    if (MixerEditor.settings.loadAfterStroke) {
        try {
            const p = mixerCanvasCtx.getImageData(Math.floor(loc.x), Math.floor(loc.y), 1, 1).data;
            if (p[3] > 0) { 
                brushReservoirColor = { r: p[0], g: p[1], b: p[2] };
            }
        } catch(err) {
            console.log("Canvas boundary safety handled.");
        }
    }
    paintMixerStroke(e);
}

function paintMixerStroke(e) {
    if (!isPaintingWithMixer || !mixerCanvasCtx || !MixerEditor) return;

    const currentLoc = getCanvasMouseLocation(e);
    
    // Connect coordinates between mouse tracking frames to build a continuous stroke
    const distance = Math.hypot(currentLoc.x - lastMousePos.x, currentLoc.y - lastMousePos.y);
    const steps = Math.max(1, Math.floor(distance / 2)); // Interpolate pixel steps

    for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        const x = lastMousePos.x + (currentLoc.x - lastMousePos.x) * t;
        const y = lastMousePos.y + (currentLoc.y - lastMousePos.y) * t;
        mixPixelsAtPosition(x, y);
    }

    lastMousePos = currentLoc;

    // Refresh UI layer presentation instantly 
    if (window.CanvasEditor && typeof window.CanvasEditor.redraw === "function") {
        window.CanvasEditor.redraw();
    }
}

function mixPixelsAtPosition(centerX, centerY) {
    const radius = MixerEditor.settings.size;
    const wet = MixerEditor.settings.wet / 100;
    const mix = MixerEditor.settings.mix / 100;

    const startX = Math.max(0, Math.floor(centerX - radius));
    const startY = Math.max(0, Math.floor(centerY - radius));
    const width = Math.min(mixerMainCanvas.width - startX, Math.floor(radius * 2));
    const height = Math.min(mixerMainCanvas.height - startY, Math.floor(radius * 2));

    if (width <= 0 || height <= 0) return;

    let imgData = mixerCanvasCtx.getImageData(startX, startY, width, height);
    let data = imgData.data;

    let rBrush = brushReservoirColor ? brushReservoirColor.r : 255;
    let gBrush = brushReservoirColor ? brushReservoirColor.g : 255;
    let bBrush = brushReservoirColor ? brushReservoirColor.b : 255;

    let pixelIdx = 0;

    for (let yOffset = 0; yOffset < height; yOffset++) {
        for (let xOffset = 0; xOffset < width; xOffset++) {
            let dx = (startX + xOffset) - centerX;
            let dy = (startY + yOffset) - centerY;
            
            if (dx * dx + dy * dy <= radius * radius) {
                let i = (yOffset * width + xOffset) * 4;

                let rCanvas = data[i];
                let gCanvas = data[i + 1];
                let bCanvas = data[i + 2];

// Combined dynamic fluid color mapping
                let blendedR = (rBrush * (1 - mix)) + (rCanvas * mix);
                let blendedG = (gBrush * (1 - mix)) + (gCanvas * mix);
                let blendedB = (bBrush * (1 - mix)) + (bCanvas * mix);

                // FIX: Wetness formula swapped so high slider settings yield stronger canvas changes
                data[i]     = (blendedR * wet) + (rCanvas * (1 - wet));
                data[i + 1] = (blendedG * wet) + (gCanvas * (1 - wet));
                data[i + 2] = (blendedB * wet) + (bCanvas * (1 - wet));
            }
        }
    }

    mixerCanvasCtx.putImageData(imgData, startX, startY);

    // FIX: Reservoir tracking moved completely outside the loop matrix to cleanly target the stroke center point
    if (brushReservoirColor && centerX >= 0 && centerX < mixerMainCanvas.width && centerY >= 0 && centerY < mixerMainCanvas.height) {
        try {
            const centerPixel = mixerCanvasCtx.getImageData(Math.floor(centerX), Math.floor(centerY), 1, 1).data;
            if (centerPixel[3] > 0) { // Structural alpha safety check
                brushReservoirColor.r = (brushReservoirColor.r * 0.95) + (centerPixel[0] * 0.05);
                brushReservoirColor.g = (brushReservoirColor.g * 0.95) + (centerPixel[1] * 0.05);
                brushReservoirColor.b = (brushReservoirColor.b * 0.95) + (centerPixel[2] * 0.05);
            }
        } catch (e) {

            }
        }
    

    mixerCanvasCtx.putImageData(imgData, startX, startY);
}

function endMixerStroke() {
    if (!isPaintingWithMixer) return;
    isPaintingWithMixer = false;

    // Direct Commit: Fire baking execution into photo_editor storage variables
    if (window.CanvasEditor && typeof window.CanvasEditor.bakeDirectCanvasChanges === 'function') {
        window.CanvasEditor.bakeDirectCanvasChanges();
    }

    if (MixerEditor.settings.cleanAfterStroke) {
        brushReservoirColor = { r: 0, g: 173, b: 181 };
    }
}
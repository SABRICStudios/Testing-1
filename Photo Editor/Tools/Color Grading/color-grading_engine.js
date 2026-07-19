/**
 * Visuals Photo Editor - Color Grading Math Engine
 * Performs luminosity zone extraction and real-time pixel color mathematical injection.
 */

let gradingCanvasCtx = null;
let gradingMainCanvas = null;
let gradingBackupSnapshot = null;

/**
 * Initializes and backs up the original clean canvas state
 */
function initGradingEngine() {
    // Dynamic Fallback: Target the active pipeline buffer canvas rather than the flat layout element
    gradingMainCanvas = window.imgState?.imageXCanvas || document.getElementById('editorCanvas');
    if (!gradingMainCanvas) return;

    gradingCanvasCtx = gradingMainCanvas.getContext('2d');
    
    // Store original image frame data for pixel processing operations
    gradingBackupSnapshot = gradingCanvasCtx.getImageData(0, 0, gradingMainCanvas.width, gradingMainCanvas.height);
}

/**
 * Restores the canvas back to the clean snapshot if canceled
 */
function revertGradingChanges() {
    if (gradingCanvasCtx && gradingBackupSnapshot) {
        gradingCanvasCtx.putImageData(gradingBackupSnapshot, 0, 0);
        // Trigger a fresh redraw pass across global frames
        if (window.CanvasEditor && typeof window.CanvasEditor.redraw === "function") {
            window.CanvasEditor.redraw();
        }
    }
}

/**
 * Inline Pixel Array Adjustments Hook for Canvas Editor Pipeline Intercepts
 * Processes data directly on an in-memory buffer without destructive intermediate puts.
 */
function processColorGradingPixelData(imgData) {
    if (!imgData || !GradingEditor) return imgData;

    let data = imgData.data;
    const len = data.length;

    // Convert UI states (HSL) into operational processing RGB vectors
    const shadowRGB = hslToRgbOffset(GradingEditor.states.shadows.hue, GradingEditor.states.shadows.sat);
    const midtoneRGB = hslToRgbOffset(GradingEditor.states.midtones.hue, GradingEditor.states.midtones.sat);
    const highlightRGB = hslToRgbOffset(GradingEditor.states.highlights.hue, GradingEditor.states.highlights.sat);

    // Normalize balance shift mapping ranges
    const balanceShift = GradingEditor.balance / 100; // Value between -1.0 and 1.0
    const blendRange = Math.max(0.01, GradingEditor.blending / 100); 

    for (let i = 0; i < len; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        let a = data[i + 3];

        // 1. Calculate relative pixel luminance (standard ITU-R BT.709 weighting formula)
        let luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

        // Apply global Balance shift modifier across thresholds
        if (balanceShift > 0) {
            luminance = Math.pow(luminance, 1.0 - balanceShift * 0.7);
        } else if (balanceShift < 0) {
            luminance = Math.pow(luminance, 1.0 / (1.0 + balanceShift * 0.7));
        }

        // 2. Weights calculations for three zones using smooth ease bell-curve distributions
        let wShadow = Math.max(0, 1 - (luminance / blendRange));
        let wHighlight = Math.max(0, 1 - ((1 - luminance) / blendRange));
        let wMidtone = Math.max(0, 1 - wShadow - wHighlight);

        // Normalize weights smoothly so they combine to 1
        let totalWeight = wShadow + wMidtone + wHighlight;
        if (totalWeight > 0) {
            wShadow /= totalWeight;
            wMidtone /= totalWeight;
            wHighlight /= totalWeight;
        }

        // 3. Compute structural color factor offset values
        let finalR = r + (shadowRGB.r * wShadow) + (midtoneRGB.r * wMidtone) + (highlightRGB.r * wHighlight);
        let finalG = g + (shadowRGB.g * wShadow) + (midtoneRGB.g * wMidtone) + (highlightRGB.g * wHighlight);
        let finalB = b + (shadowRGB.b * wShadow) + (midtoneRGB.b * wMidtone) + (highlightRGB.b * wHighlight);

        // 4. Overwrite clamped channels safely onto output back-buffer data
        data[i]     = finalR > 255 ? 255 : (finalR < 0 ? 0 : finalR);
        data[i + 1] = finalG > 255 ? 255 : (finalG < 0 ? 0 : finalG);
        data[i + 2] = finalB > 255 ? 255 : (finalB < 0 ? 0 : finalB);
    }
    return imgData;
}

/**
 * Core Pixel Processing Pipeline Engine Loop (Stand-alone/Live UI Trigger Mode)
 */
function applyColorGradingEngine() {
    // If the grading workspace module is active, tell the primary engine loop to redraw the stack
    if (window.CanvasEditor && typeof window.CanvasEditor.applyEffectsPipeline === 'function') {
        window.CanvasEditor.applyEffectsPipeline();
    } else if (gradingCanvasCtx && gradingBackupSnapshot) {
        // Fallback backward compatibility loop
        let outputImageData = gradingCanvasCtx.createImageData(gradingMainCanvas.width, gradingMainCanvas.height);
        outputImageData.data.set(gradingBackupSnapshot.data);
        outputImageData = processColorGradingPixelData(outputImageData);
        gradingCanvasCtx.putImageData(outputImageData, 0, 0);
    }
}

/**
 * Utility Helper: Converts Hue & Saturation into scaled RGB offset tints
 */
function hslToRgbOffset(h, s) {
    if (s === 0) return { r: 0, g: 0, b: 0 };
    
    let saturationNormalized = s / 100;
    let hueNormalized = h / 360;
    
    let q = 0.5; // Fixed midpoint target lightness mapping factor
    let p = 0;
    
    let rChannel = hueToRgbFactor(p, q, hueNormalized + 1/3);
    let gChannel = hueToRgbFactor(p, q, hueNormalized);
    let bChannel = hueToRgbFactor(p, q, hueNormalized - 1/3);
    
    // Scale vectors so they translate cleanly to dynamic range boosters
    const intensityScalingFactor = 65; 
    return {
        r: (rChannel - 0.25) * saturationNormalized * intensityScalingFactor,
        g: (gChannel - 0.25) * saturationNormalized * intensityScalingFactor,
        b: (bChannel - 0.25) * saturationNormalized * intensityScalingFactor
    };
}

function hueToRgbFactor(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
}
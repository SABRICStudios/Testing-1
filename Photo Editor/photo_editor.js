// photo_editor.js - Core State Engine & Viewport Rendering

window.imgState = {
    img: null,            // Pristine completely unaltered original file asset
    imageXCanvas: null,   // Dynamic preview viewport canvas holding the rendering layers
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    isSelected: false, 
    handleSize: 10
};

// Re-established optimization rendering lock flag
window.canvasRenderPending = false;

window.CanvasEditor = {
    getState: () => window.imgState,
    
    /**
     * Builds an isolated working buffer image context representing everything
     * calculated prior to running an individual editing session tool.
     */
    getWorkingImage: () => {
        const cleanCanvas = document.createElement('canvas');
        if (!window.imgState.img) return cleanCanvas;

        cleanCanvas.width = window.imgState.img.width;
        cleanCanvas.height = window.imgState.img.height;
        
        const ctx = cleanCanvas.getContext('2d');
        ctx.drawImage(window.imgState.img, 0, 0);
        return cleanCanvas;
    },

    bakeDirectCanvasChanges: function() {
        if (!window.imgState.img || !window.imgState.imageXCanvas) return;
        
        const nextImg = new Image();
        nextImg.src = window.imgState.imageXCanvas.toDataURL();
        nextImg.onload = () => {
            window.imgState.img = nextImg;
            if (window.HistoryManager && typeof window.HistoryManager.pushState === 'function') {
                window.HistoryManager.pushState(nextImg);
            }
        };
    },

    // RESTORES the original image state onto the canvas when the user clicks Discard/Back
    rollbackDirectCanvasChanges: function(cachedImageData) {
        if (!window.imgState.imageXCanvas || !cachedImageData) return;
        const ctx = window.imgState.imageXCanvas.getContext('2d');
        ctx.putImageData(cachedImageData, 0, 0);
        this.redraw();
    },

    /**
     * Central processing module processing all tools sequentially
     * Optimally patched to run non-blocking on mobile viewport threads
     */
    applyEffectsPipeline: () => {
        // FIXED: Guard clause to reject pipeline execution requests if a frame repaint cycle is pending
        if (window.canvasRenderPending) return;

        if (!window.imgState.img || !window.imgState.imageXCanvas) return;

        window.canvasRenderPending = true;

        // FIXED: Wrapped the computations back inside requestAnimationFrame to let the UI breathe
        requestAnimationFrame(() => {
            try {
                const originalImg = window.imgState.img;
                const targetCanvas = window.imgState.imageXCanvas;
                const ctx = targetCanvas.getContext('2d');

                if (!window.HistoryManager) return;
                const configMatrix = window.HistoryManager.getCurrentParameters();

                // --- 1. DYNAMIC MATRIX TRANSFORMATION COMPOSITOR ---
                const transformState = configMatrix.transform || { width: 0, height: 0, rotation: 0 };
                
                const targetWidth = transformState.width || originalImg.width;
                const targetHeight = transformState.height || originalImg.height;
                const degrees = transformState.rotation || 0;

                const isOrthogonal = (degrees / 90) % 2 !== 0;
                targetCanvas.width = isOrthogonal ? targetHeight : targetWidth;
                targetCanvas.height = isOrthogonal ? targetWidth : targetHeight;

                ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
                ctx.save();
                
                ctx.translate(targetCanvas.width / 2, targetCanvas.height / 2);
                ctx.rotate((degrees * Math.PI) / 180);

                const srcRatio = originalImg.width / originalImg.height;
                const destRatio = targetWidth / targetHeight;

                let renderW, renderH;
                if (srcRatio > destRatio) {
                    renderW = targetWidth;
                    renderH = targetWidth / srcRatio;
                } else {
                    renderH = targetHeight;
                    renderW = targetHeight * srcRatio;
                }

                ctx.drawImage(originalImg, -renderW / 2, -renderH / 2, renderW, renderH);
                ctx.restore();

                // --- LIVE INTERCEPT FILTER DECORATOR PIPELINE ---
                let imgData = ctx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);

                let filterState = null;
                if (window.BaselineFilterHistory) {
                    filterState = window.BaselineFilterHistory.getCurrentState();
                }

                if (!filterState || filterState.type === 'none') {
                    filterState = configMatrix.filter || { type: 'none', intensity: 100 };
                }

                if (filterState && filterState.type !== 'none' && filterState.intensity > 0) {
                    if (window.FilterEngine && typeof window.FilterEngine.process === 'function') {
                        imgData = window.FilterEngine.process(imgData, filterState.type, filterState.intensity);
                    }
                }

                // --- 2. SOURCE ALIGNMENT PIXEL EFFECTS PIPELINE ---
                let scalar = { ...(configMatrix.scalar || { exposure: 0, brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0 }) };
                let baseline = { ...(configMatrix.baseline || { highlights: 0, shadows: 0, clarity: 0, sharpen: 0, vibrance: 0, vignette: 0 }) };

                // LIVE INTERCEPT: Read real-time scalar adjustments (exposure, brightness, contrast, etc.)
                if (window.ParameterHistory && window.ParameterHistory.values) {
                    const scalarKeys = ['exposure', 'brightness', 'contrast', 'saturation', 'temperature', 'tint'];
                    scalarKeys.forEach(key => {
                        if (window.ParameterHistory.values[key] !== undefined) {
                            scalar[key] = key === 'exposure' ? parseFloat(window.ParameterHistory.values[key]) : parseInt(window.ParameterHistory.values[key], 10);
                        }
                    });
                }

                // LIVE INTERCEPT: Read real-time baseline adjustments (highlights, shadows, etc.)
                if (window.BaselineHistory && typeof window.BaselineHistory.getActiveState === 'function') {
                    const liveBaseline = window.BaselineHistory.getActiveState();
                    if (liveBaseline && liveBaseline.toolValues) {
                        baseline = liveBaseline.toolValues;
                    }
                }

                let data = imgData.data;
                const len = data.length;

                // PRE-CALCULATE SCALAR & BASELINE COEFFICIENTS
                const saturationFactor = (scalar.saturation + 100) / 100;
                const bright = scalar.brightness;
                const expFactor = Math.pow(2, scalar.exposure);
                const tempOffset = scalar.temperature * 0.4;
                const tintOffset = scalar.tint * 0.4;

                const highFactor = baseline.highlights / 100;
                const shadowFactor = baseline.shadows / 100;
                const vibFactor = baseline.vibrance / 100;

                for (let i = 0; i < len; i += 4) {
                    let r = data[i];
                    let g = data[i + 1];
                    let b = data[i + 2];

                    // --- SCALAR CORE PER-PIXEL KERNELS ---
                    if (scalar.exposure !== 0) {
                        r *= expFactor;
                        g *= expFactor;
                        b *= expFactor;
                    }

                    if (bright !== 0) {
                        r += bright;
                        g += bright;
                        b += bright;
                    }

                    if (scalar.contrast !== 0) {
                        const cFactor = (259 * (scalar.contrast + 255)) / (255 * (259 - scalar.contrast));
                        r = cFactor * (r - 128) + 128;
                        g = cFactor * (g - 128) + 128;
                        b = cFactor * (b - 128) + 128;
                    }

                    if (scalar.saturation !== 0) {
                        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
                        r = luma + (r - luma) * saturationFactor;
                        g = luma + (g - luma) * saturationFactor;
                        b = luma + (b - luma) * saturationFactor;
                    }

                    if (scalar.temperature !== 0) {
                        r += tempOffset;
                        b -= tempOffset;
                    }
                    if (scalar.tint !== 0) {
                        g += tintOffset;
                    }

                    // --- COMPLEX BASELINE TOOLS ---
                    const luma = 0.299 * r + 0.587 * g + 0.114 * b;

                    if (baseline.highlights !== 0 && luma > 128) {
                        const weight = Math.pow((luma - 128) / 127, 2); 
                        const diff = highFactor * 40 * weight;
                        r += diff; g += diff; b += diff;
                    }

                    if (baseline.shadows !== 0 && luma < 128) {
                        const weight = Math.pow((128 - luma) / 128, 2);
                        const diff = shadowFactor * 40 * weight;
                        r += diff; g += diff; b += diff;
                    }

                    if (baseline.vibrance !== 0) {
                        const max = Math.max(r, g, b);
                        const avg = (r + g + b) / 3;
                        const amtV = Math.abs(max - avg) * 2 / 255 * vibFactor;
                        r += (max - r) * amtV;
                        g += (max - g) * amtV;
                        b += (max - b) * amtV;
                    }

                    // --- LIVE CURVES VALUE MAPPING INTERCEPT ---
                    if (window.CurvesManager && window.CurvesManager.activeState && window.CurvesManager.activeState.active) {
                        const curvesState = window.CurvesManager.activeState;
                        const cleanR = Math.min(255, Math.max(0, Math.round(r)));
                        const cleanG = Math.min(255, Math.max(0, Math.round(g)));
                        const cleanB = Math.min(255, Math.max(0, Math.round(b)));

                        if (curvesState.lutR) r = curvesState.lutR[cleanR];
                        if (curvesState.lutG) g = curvesState.lutG[cleanG];
                        if (curvesState.lutB) b = curvesState.lutB[cleanB];
                    }

                    data[i]     = Math.min(255, Math.max(0, r));
                    data[i + 1] = Math.min(255, Math.max(0, g));
                    data[i + 2] = Math.min(255, Math.max(0, b));
                } 

                // --- 3. CONVOLUTIONAL AND AREA BASELINE EFFECTS ---
                let detailsState = configMatrix.details || { sharpenAmount: 0, sharpenRadius: 1.0, sharpenThreshold: 25, sharpenMasking: 0, noiseLuminance: 0, noiseLumDetail: 50, noiseColor: 0 };
                if (window.DetailsManager && window.DetailsManager.activeState) {
                    detailsState = window.DetailsManager.activeState;
                }
                
                if (window.DetailsEngine && typeof window.DetailsEngine.process === 'function') {
                    imgData = window.DetailsEngine.process(imgData, detailsState);
                }

                if (baseline.sharpen !== 0) {
                    imgData = window.CanvasEditor._applySharpenKernel(imgData, baseline.sharpen);
                }

                if (baseline.clarity !== 0) {
                    imgData = window.CanvasEditor._applyClarityKernel(imgData, baseline.clarity);
                }

                ctx.putImageData(imgData, 0, 0);

                // --- VIGNETTE POST-PROCESSING LAYER ---
                if (baseline.vignette !== 0) {
                    ctx.save();
                    ctx.globalCompositeOperation = 'source-over';
                    
                    const cx = targetCanvas.width / 2;
                    const cy = targetCanvas.height / 2;
                    const maxRadius = Math.sqrt(cx * cx + cy * cy);
                    
                    const gradient = ctx.createRadialGradient(cx, cy, maxRadius * 0.2, cx, cy, maxRadius * 0.85);
                    const opacity = Math.min(1, Math.abs(baseline.vignette) / 100);
                    
                    if (baseline.vignette > 0) {
                        gradient.addColorStop(0, 'rgba(0,0,0,0)');
                        gradient.addColorStop(1, `rgba(0,0,0,${opacity * 0.85})`);
                    } else {
                        gradient.addColorStop(0, 'rgba(255,255,255,0)');
                        gradient.addColorStop(1, `rgba(255,255,255,${opacity * 0.85})`);
                    }
                    
                    ctx.fillStyle = gradient;
                    ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
                    ctx.restore();
                }

                if (typeof window.CanvasEditor.redraw === "function") {
                    window.CanvasEditor.redraw();
                }
                
            } catch (error) {
                console.error("Pipeline processing failure:", error);
            } finally {
                // Relinquish rendering lock flag for the next cycle execution
                window.canvasRenderPending = false;
            }
        });
    },

    _applySharpenKernel: (imgData, value) => {
        const w = imgData.width;
        const h = imgData.height;
        const src = imgData.data;
        
        const outCanvas = document.createElement('canvas');
        outCanvas.width = w;
        outCanvas.height = h;
        const outCtx = outCanvas.getContext('2d');
        const outImgData = outCtx.createImageData(w, h);
        const dst = outImgData.data;

        const strength = (value / 100) * 0.5;
        const kCenter = 1 + 4 * strength;
        const kEdge = -strength;

        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const idx = (y * w + x) * 4;

                for (let c = 0; c < 3; c++) {
                    const currentIdx = idx + c;
                    const val = src[currentIdx] * kCenter +
                                (src[currentIdx - 4] + src[currentIdx + 4] + 
                                 src[currentIdx - w * 4] + src[currentIdx + w * 4]) * kEdge;
                    dst[currentIdx] = Math.min(255, Math.max(0, val));
                }
                dst[idx + 3] = src[idx + 3];
            }
        }
        return outImgData;
    },

    _applyClarityKernel: (imgData, value) => {
        const w = imgData.width;
        const h = imgData.height;
        const src = imgData.data;

        const outCanvas = document.createElement('canvas');
        outCanvas.width = w;
        outCanvas.height = h;
        const outCtx = outCanvas.getContext('2d');
        const outImgData = outCtx.createImageData(w, h);
        const dst = outImgData.data;

        const strength = value / 100;

        for (let y = 2; y < h - 2; y += 2) {
            for (let x = 2; x < w - 2; x += 2) {
                const idx = (y * w + x) * 4;
                
                const centerLuma = 0.299 * src[idx] + 0.587 * src[idx+1] + 0.114 * src[idx+2];
                const leftLuma   = 0.299 * src[idx-8] + 0.587 * src[idx-7] + 0.114 * src[idx-6];
                const rightLuma  = 0.299 * src[idx+8] + 0.587 * src[idx+9] + 0.114 * src[idx+10];
                const localAvg   = (centerLuma + leftLuma + rightLuma) / 3;

                for (let dy = 0; dy < 2; dy++) {
                    for (let dx = 0; dx < 2; dx++) {
                        const targetIdx = ((y + dy) * w + (x + dx)) * 4;
                        if (targetIdx >= src.length) continue;

                        for (let c = 0; c < 3; c++) {
                            let p = src[targetIdx + c];
                            p = p + (p - localAvg) * strength * 0.4;
                            dst[targetIdx + c] = Math.min(255, Math.max(0, p));
                        }
                        dst[targetIdx + 3] = src[targetIdx + 3];
                    }
                }
            }
        }
        return outImgData;
    },
    
    redraw: () => {
        const canvas = document.getElementById('editorCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const state = window.imgState;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (state.imageXCanvas) {
            ctx.drawImage(state.imageXCanvas, state.x, state.y, state.width, state.height);
        }
    },

    resetStateForCroppedImage: function(newWidth, newHeight) {
        const canvasArea = document.getElementById('canvas') || document.getElementById('canvasArea');
        if (!canvasArea) return;
        
        resizeCanvasToFit();
        
        const ratio = Math.min(canvasArea.clientWidth / newWidth, canvasArea.clientHeight / newHeight);
        window.imgState.width = newWidth * ratio * 0.95;
        window.imgState.height = newHeight * ratio * 0.95;
        window.imgState.x = (canvasArea.clientWidth - window.imgState.width) / 2;
        window.imgState.y = (canvasArea.clientHeight - window.imgState.height) / 2;
    }
};

function resizeCanvasToFit() {
    const canvas = document.getElementById('editorCanvas');
    const canvasArea = document.getElementById('canvas') || document.getElementById('canvasArea');
    if (!canvas || !canvasArea) return;

    const targetWidth = canvasArea.clientWidth || canvasArea.getBoundingClientRect().width;
    const targetHeight = canvasArea.clientHeight || canvasArea.getBoundingClientRect().height;

    canvas.width = targetWidth || 800;
    canvas.height = targetHeight || 600;
}

document.addEventListener("DOMContentLoaded", () => {
    resizeCanvasToFit();

    const dbRequest = indexedDB.open("VisualsDB", 1);
    
    dbRequest.onsuccess = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('images')) {
            showMissingMessage();
            return;
        }

        const transaction = db.transaction(["images"], "readonly");
        const store = transaction.objectStore("images");
        const getRequest = store.get("selectedImage");

        getRequest.onsuccess = () => {
            const fileBlob = getRequest.result;

            if (fileBlob) {
                const img = new Image();
                img.src = URL.createObjectURL(fileBlob);
                img.onload = () => {
                    window.imgState.img = img;
                    
                    const offscreen = document.createElement('canvas');
                    offscreen.width = img.width;
                    offscreen.height = img.height;
                    window.imgState.imageXCanvas = offscreen;

                    const widthInput = document.getElementById("transformWidthInput");
                    const heightInput = document.getElementById("transformHeightInput");
                    if (widthInput) widthInput.value = img.width;
                    if (heightInput) heightInput.value = img.height;

                    if (window.imgState.img) {
                        window.CanvasEditor.resetStateForCroppedImage(img.width, img.height);
                    }

                    if (window.HistoryManager) window.HistoryManager.clearToDefaultStates();
                    window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
                };
            } else {
                showMissingMessage();
            }
        };
    };

    dbRequest.onerror = () => showMissingMessage();

    function showMissingMessage() {
        const canvasArea = document.getElementById('canvas') || document.getElementById('canvasArea');
        if (canvasArea) {
            canvasArea.innerHTML = "<p style='color: white; font-family: sans-serif; text-align: center; margin-top: 20%;'>No image selected. Please go back and select an image.</p>";
        }
    }

    window.addEventListener('editorHistoryChanged', () => {
        if (window.CanvasEditor && typeof window.CanvasEditor.applyEffectsPipeline === 'function') {
            window.CanvasEditor.applyEffectsPipeline();
        }
    });
});
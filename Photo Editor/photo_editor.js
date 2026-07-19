// photo_editor.js - High Performance Live Intercept Matrix Processing
window.imgState = {
    img: null,            
    imageXCanvas: null,   
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    isSelected: false, 
    handleSize: 10,
    maintainAspectRatio: false
};

window.canvasRenderPending = false;

window.CanvasEditor = {
    isScrubbing: false, 
    
    _kernelCanvasBuffer: null,
    _kernelCtxBuffer: null,

    getState: () => window.imgState,
    
    getWorkingImage: () => {
        const cleanCanvas = document.createElement('canvas');
        if (!window.imgState.img) return cleanCanvas;
        cleanCanvas.width = window.imgState.img.width;
        cleanCanvas.height = window.imgState.img.height;
        
        // FIXED: Corrected reference container context target shell variables
        const ctx = cleanCanvas.getContext('2d');
        const state = window.imgState;
        
        ctx.save();
        ctx.translate(state.x + state.width / 2, state.y + state.height / 2);
        if (state.rotation) {
            ctx.rotate((state.rotation * Math.PI) / 180);
        }
        
        ctx.drawImage(
            window.imgState.imageXCanvas, 
            -state.width / 2, 
            -state.height / 2, 
            state.width, 
            state.height
        );
        
        ctx.restore();
        return cleanCanvas;
    },

    applyEffectsPipeline: () => {
        if (window.canvasRenderPending) return;
        if (!window.imgState.img || !window.imgState.imageXCanvas) return;

        window.canvasRenderPending = true;

        requestAnimationFrame(() => {
            try {
                const originalImg = window.imgState.img;
                const targetCanvas = window.imgState.imageXCanvas;
                const ctx = targetCanvas.getContext('2d');
                if (!window.HistoryManager) return;
                
                const configMatrix = window.HistoryManager.getCurrentParameters();
                const transformState = configMatrix.transform || {};
                
                let baseWidth = parseInt(window.imgState.width, 10) || parseInt(transformState.width, 10) || originalImg.naturalWidth || originalImg.width;
                let baseHeight = parseInt(window.imgState.height, 10) || parseInt(transformState.height, 10) || originalImg.naturalHeight || originalImg.height;
                const degrees = window.imgState.rotation !== undefined ? parseFloat(window.imgState.rotation) : (parseFloat(transformState.rotation) || 0);

                targetCanvas.width = baseWidth;
                targetCanvas.height = baseHeight;
                window.imgState.rotation = degrees;

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
                
                // FIXED: Draw image directly into context. Using putImageData right after 
                // drawing textures causes pixel scaling degradation on downsampled image layers.
                ctx.drawImage(originalImg, 0, 0, baseWidth, baseHeight);

                let imgData;
                const MAX_PREVIEW_DIM = 1024;
                
                if (window.CanvasEditor.isScrubbing && (baseWidth > MAX_PREVIEW_DIM || baseHeight > MAX_PREVIEW_DIM)) {
                    const scaleFactor = MAX_PREVIEW_DIM / Math.max(baseWidth, baseHeight);
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = Math.round(baseWidth * scaleFactor);
                    tempCanvas.height = Math.round(baseHeight * scaleFactor);
                    
                    const tempCtx = tempCanvas.getContext('2d');
                    tempCtx.drawImage(originalImg, 0, 0, tempCanvas.width, tempCanvas.height);
                    imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                } else {
                    imgData = ctx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
                }

                let scalar = { ...(configMatrix.scalar || { exposure: 0, brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0 }) };
                let baseline = { ...(configMatrix.baseline || { highlights: 0, shadows: 0, clarity: 0, sharpen: 0, vibrance: 0, vignette: 0 }) };

                if (window.ParameterHistory && window.ParameterHistory.values) {
                    const scalarKeys = ['exposure', 'brightness', 'contrast', 'saturation', 'temperature', 'tint'];
                    scalarKeys.forEach(key => {
                        if (window.ParameterHistory.values[key] !== undefined) {
                            scalar[key] = key === 'exposure' ? parseFloat(window.ParameterHistory.values[key]) : parseInt(window.ParameterHistory.values[key], 10);
                        }
                    });
                }

                if (window.BaselineHistory && typeof window.BaselineHistory.getActiveState === 'function') {
                    const liveBaseline = window.BaselineHistory.getActiveState();
                    if (liveBaseline && liveBaseline.toolValues) {
                        baseline = liveBaseline.toolValues;
                    }
                }

                let data = imgData.data;
                const len = data.length;

                const hasExposure   = scalar.exposure !== 0;
                const hasBrightness = scalar.brightness !== 0;
                const hasContrast   = scalar.contrast !== 0;
                const hasSaturation = scalar.saturation !== 0;
                const hasTempTint   = scalar.temperature !== 0 || scalar.tint !== 0;
                const hasHighlights = baseline.highlights !== 0;
                const hasShadows    = baseline.shadows !== 0;
                const hasVibrance   = baseline.vibrance !== 0;

                const expFactor      = hasExposure ? Math.pow(2, scalar.exposure) : 1;
                const bright         = scalar.brightness;
                const cFactor        = hasContrast ? (259 * (scalar.contrast + 255)) / (255 * (259 - scalar.contrast)) : 1;
                const saturationFactor = (scalar.saturation + 100) / 100;
                const tempOffset     = scalar.temperature * 0.4;
                const tintOffset     = scalar.tint * 0.4;

                const highFactor     = baseline.highlights / 100;
                const shadowFactor   = baseline.shadows / 100;
                const vibFactor      = baseline.vibrance / 100;

                for (let i = 0; i < len; i += 4) {
                    let r = data[i]; let g = data[i + 1]; let b = data[i + 2];

                    if (hasExposure)   { r *= expFactor; g *= expFactor; b *= expFactor; }
                    if (hasBrightness) { r += bright; g += bright; b += bright; }
                    if (hasContrast)   { r = cFactor * (r - 128) + 128; g = cFactor * (g - 128) + 128; b = cFactor * (b - 128) + 128; }
                    
                    if (hasSaturation) {
                        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
                        r = luma + (r - luma) * saturationFactor; g = luma + (g - luma) * saturationFactor; b = luma + (b - luma) * saturationFactor;
                    }
                    if (hasTempTint) { r += tempOffset; g += tintOffset; b -= tempOffset; }

                    if (hasHighlights || hasShadows || hasVibrance) {
                        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
                        if (hasHighlights && luma > 128) {
                            const weight = Math.pow((luma - 128) / 127, 2);
                            const diff = highFactor * 40 * weight;
                            r += diff; g += diff; b += diff;
                        }
                        if (hasShadows && luma < 128) {
                            const weight = Math.pow((128 - luma) / 128, 2);
                            const diff = shadowFactor * 40 * weight;
                            r += diff; g += diff; b += diff;
                        }
                        if (hasVibrance) {
                            const max = Math.max(r, g, b); const avg = (r + g + b) / 3;
                            const amtV = Math.abs(max - avg) * 2 / 255 * vibFactor;
                            r += (max - r) * amtV; g += (max - g) * amtV; b += (max - b) * amtV;
                        }
                    }


                    // --- LIVE WINDOW CURVES INTERCEPT MATRIX PASS ---
                    if (window.CurvesManager && window.CurvesManager.activeState && window.CurvesManager.activeState.active) {
                        const lut = window.CurvesManager.activeState;
                        // Remap extracted workspace configurations through active LUT arrays
                        if (lut.lutR) r = lut.lutR[Math.round(r > 255 ? 255 : (r < 0 ? 0 : r))];
                        if (lut.lutG) g = lut.lutG[Math.round(g > 255 ? 255 : (g < 0 ? 0 : g))];
                        if (lut.lutB) b = lut.lutB[Math.round(b > 255 ? 255 : (b < 0 ? 0 : b))];
                    }


                    data[i]     = r > 255 ? 255 : (r < 0 ? 0 : r);
                    data[i + 1] = g > 255 ? 255 : (g < 0 ? 0 : g); 
                    data[i + 2] = b > 255 ? 255 : (b < 0 ? 0 : b);
                } 


                if (typeof processColorGradingPixelData === 'function') {
                    imgData = processColorGradingPixelData(imgData);
                }


                if (configMatrix.filter && configMatrix.filter.type !== 'none' && window.FilterEngine) {
                    imgData = window.FilterEngine.process(imgData, configMatrix.filter.type, configMatrix.filter.intensity);
                }

                if (configMatrix.details && window.DetailsEngine && typeof window.DetailsEngine.process === 'function') {
                    imgData = window.DetailsEngine.process(imgData, configMatrix.details);
                }

            // ================================================
            // FIXED: ROBUST BLUR PROCESSING (LIVE & CONFIRMED)
            // ================================================
            // Pull directly from DOM elements first for perfect real-time accuracy, fall back to state matrix
            const gaussianInput = document.getElementById('gaussianSlider');
            const radialInput = document.getElementById('radialSlider');
            
            const radius = gaussianInput ? parseFloat(gaussianInput.value) : (configMatrix.blur?.gaussian || 0);
            const intensity = radialInput ? parseInt(radialInput.value, 10) : (configMatrix.blur?.radial || 0);

            if (radius > 0 && typeof BlurFilters !== 'undefined' && BlurFilters.applyGaussian) {
                if (window.CanvasEditor.isScrubbing) {
                    const srcWidth = originalImg.naturalWidth || originalImg.width || targetCanvas.width;
                    const runtimeRadius = Math.max(1, Math.round(radius * (imgData.width / srcWidth)));
                    imgData = BlurFilters.applyGaussian(imgData, runtimeRadius);
                } else {
                    // Apply exact intended radius to full-res buffer on mouse release
                    imgData = BlurFilters.applyGaussian(imgData, radius);
                }
            }

            if (intensity > 0 && typeof BlurFilters !== 'undefined' && BlurFilters.applyRadialDepth) {
                imgData = BlurFilters.applyRadialDepth(imgData, intensity);
            }

            // --- PLUG DIRECTLY INTO SUBSEQUENT KERNELS WITHOUT REWRITING IMAGE DATA ---
            if (baseline.sharpen !== 0) {
                imgData = window.CanvasEditor._applySharpenKernel(imgData, baseline.sharpen);
            }

            if (baseline.clarity !== 0) {
                imgData = window.CanvasEditor._applyClarityKernel(imgData, baseline.clarity);
            }

            // --- FINAL CANVAS COMPOSITING PASS ---
            if (window.CanvasEditor.isScrubbing && (baseWidth > MAX_PREVIEW_DIM || baseHeight > MAX_PREVIEW_DIM)) {
                ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
                
                const tempRenderCanvas = document.createElement('canvas');
                tempRenderCanvas.width = imgData.width;
                tempRenderCanvas.height = imgData.height;
                tempRenderCanvas.getContext('2d').putImageData(imgData, 0, 0);
                
                ctx.drawImage(tempRenderCanvas, 0, 0, targetCanvas.width, targetCanvas.height);
            } else {
                if (targetCanvas.width !== imgData.width || targetCanvas.height !== imgData.height) {
                    targetCanvas.width = imgData.width;
                    targetCanvas.height = imgData.height;
                }
                ctx.putImageData(imgData, 0, 0);
            }
            // ================================================

                if (window.CanvasEditor.isScrubbing && (baseWidth > MAX_PREVIEW_DIM || baseHeight > MAX_PREVIEW_DIM)) {
                    ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
                    const tempRenderCanvas = document.createElement('canvas');
                    tempRenderCanvas.width = imgData.width;
                    tempRenderCanvas.height = imgData.height;
                    tempRenderCanvas.getContext('2d').putImageData(imgData, 0, 0);
                    ctx.drawImage(tempRenderCanvas, 0, 0, targetCanvas.width, targetCanvas.height);
                } else {
                    if (targetCanvas.width !== imgData.width || targetCanvas.height !== imgData.height) {
                        targetCanvas.width = imgData.width;
                        targetCanvas.height = imgData.height;
                    }
                    ctx.putImageData(imgData, 0, 0);
                }

                if (baseline.vignette !== 0) {
                    imgData = window.CanvasEditor._applySharpenKernel(imgData, baseline.sharpen);
                }

                if (baseline.clarity !== 0) {
                    imgData = window.CanvasEditor._applyClarityKernel(imgData, baseline.clarity);
                }

                // FIXED: Safely verify that operations have not introduced pixel array bounds mismatches
                if (targetCanvas.width !== imgData.width || targetCanvas.height !== imgData.height) {
                    targetCanvas.width = imgData.width;
                    targetCanvas.height = imgData.height;
                }
                ctx.putImageData(imgData, 0, 0);

                if (baseline.vignette !== 0) {
                    ctx.save();
                    ctx.globalCompositeOperation = 'source-over';
                    const cx = targetCanvas.width / 2; const cy = targetCanvas.height / 2;
                    const maxRadius = Math.sqrt(cx * cx + cy * cy);
                    const gradient = ctx.createRadialGradient(cx, cy, maxRadius * 0.2, cx, cy, maxRadius * 0.85);
                    const opacity = Math.min(1, Math.abs(baseline.vignette) / 100);
                    
                    if (baseline.vignette > 0) {
                        gradient.addColorStop(0, 'rgba(0,0,0,0)'); gradient.addColorStop(1, `rgba(0,0,0,${opacity * 0.85})`);
                    } else {
                        gradient.addColorStop(0, 'rgba(255,255,255,0)'); gradient.addColorStop(1, `rgba(255,255,255,${opacity * 0.85})`);
                    }
                    ctx.fillStyle = gradient; ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
                    ctx.restore();
                }

                if (typeof window.CanvasEditor.redraw === "function") {
                    window.CanvasEditor.redraw();
                }
                
            } catch (error) {
                console.error("Pipeline processing failure:", error);
            } finally {
                window.canvasRenderPending = false;
            }
        });
    },

    _applySharpenKernel: (imgData, value) => {
        const w = imgData.width; const h = imgData.height;
        const src = imgData.data;
        
        if (!window.CanvasEditor._kernelCanvasBuffer) {
            window.CanvasEditor._kernelCanvasBuffer = document.createElement('canvas');
        }
        const bufferCanvas = window.CanvasEditor._kernelCanvasBuffer;
        if (bufferCanvas.width !== w || bufferCanvas.height !== h) {
            bufferCanvas.width = w; bufferCanvas.height = h;
            window.CanvasEditor._kernelCtxBuffer = bufferCanvas.getContext('2d');
        }
        
        const outImgData = window.CanvasEditor._kernelCtxBuffer.createImageData(w, h);
        const dst = outImgData.data;
        const strength = (value / 100) * 0.5;
        const kCenter = 1 + 4 * strength; const kEdge = -strength;

        for (let y = 1; y < h - 1; y++) {
            const rowOffset = y * w;
            const prevRowOffset = (y - 1) * w;
            const nextRowOffset = (y + 1) * w;

            for (let x = 1; x < w - 1; x++) {
                const idx = (rowOffset + x) * 4;
                const leftIdx = idx - 4; const rightIdx = idx + 4;
                const topIdx = (prevRowOffset + x) * 4; const btmIdx = (nextRowOffset + x) * 4;

                let r = src[idx] * kCenter + (src[leftIdx] + src[rightIdx] + src[topIdx] + src[btmIdx]) * kEdge;
                let g = src[idx+1] * kCenter + (src[leftIdx+1] + src[rightIdx+1] + src[topIdx+1] + src[btmIdx+1]) * kEdge;
                let b = src[idx+2] * kCenter + (src[leftIdx+2] + src[rightIdx+2] + src[topIdx+2] + src[btmIdx+2]) * kEdge;

                dst[idx]     = r > 255 ? 255 : (r < 0 ? 0 : r);
                dst[idx + 1] = g > 255 ? 255 : (g < 0 ? 0 : g);
                dst[idx + 2] = b > 255 ? 255 : (b < 0 ? 0 : b);
                dst[idx + 3] = src[idx + 3];
            }
        }
        return outImgData;
    },

    _applyClarityKernel: (imgData, value) => {
        const w = imgData.width; const h = imgData.height;
        const src = imgData.data;

        if (!window.CanvasEditor._kernelCanvasBuffer) {
            window.CanvasEditor._kernelCanvasBuffer = document.createElement('canvas');
        }
        const bufferCanvas = window.CanvasEditor._kernelCanvasBuffer;
        if (bufferCanvas.width !== w || bufferCanvas.height !== h) {
            bufferCanvas.width = w; bufferCanvas.height = h;
            window.CanvasEditor._kernelCtxBuffer = bufferCanvas.getContext('2d');
        }
        
        const outImgData = window.CanvasEditor._kernelCtxBuffer.createImageData(w, h);
        const dst = outImgData.data;
        dst.set(src); 

        const strength = (value / 100) * 0.35;
        const stride = window.CanvasEditor.isScrubbing ? 4 : 2; 

        for (let y = 2; y < h - 2; y += stride) {
            const currentYOffset = y * w;
            for (let x = 2; x < w - 2; x += stride) {
                const idx = (currentYOffset + x) * 4;
                
                const centerLuma = 0.299 * src[idx] + 0.587 * src[idx+1] + 0.114 * src[idx+2];
                const leftLuma   = 0.299 * src[idx-8] + 0.587 * src[idx-7] + 0.114 * src[idx-6];
                const rightLuma  = 0.299 * src[idx+8] + 0.587 * src[idx+9] + 0.114 * src[idx+10];
                const localAvg   = (centerLuma + leftLuma + rightLuma) / 3;

                for (let dy = 0; dy < stride; dy++) {
                    const blockYOffset = ((y + dy) * w);
                    for (let dx = 0; dx < stride; dx++) {
                        const targetIdx = (blockYOffset + (x + dx)) * 4;
                        if (targetIdx >= src.length) continue;

                        let r = src[targetIdx]; let g = src[targetIdx + 1]; let b = src[targetIdx + 2];
                        
                        r = r + (r - localAvg) * strength;
                        g = g + (g - localAvg) * strength;
                        b = b + (b - localAvg) * strength;

                        dst[targetIdx]     = r > 255 ? 255 : (r < 0 ? 0 : r);
                        dst[targetIdx + 1] = g > 255 ? 255 : (g < 0 ? 0 : g);
                        dst[targetIdx + 2] = b > 255 ? 255 : (b < 0 ? 0 : b);
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

        if (!state.img || !state.imageXCanvas) return;

        const canvasArea = document.getElementById('canvas') || document.getElementById('canvasArea');
        const targetW = canvasArea ? (canvasArea.clientWidth || 800) : 800;
        const targetH = canvasArea ? (canvasArea.clientHeight || 600) : 600;
        
        if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const MAX_PREVIEW_DIM = 1024;
        const needsDownsample = (state.width > MAX_PREVIEW_DIM || state.height > MAX_PREVIEW_DIM);
        ctx.imageSmoothingEnabled = !(window.CanvasEditor.isScrubbing && needsDownsample);
        ctx.imageSmoothingQuality = 'high';

        ctx.save();
        
        const centerX = state.x + state.width / 2;
        const centerY = state.y + state.height / 2;

        ctx.translate(centerX, centerY);
        ctx.rotate((state.rotation * Math.PI) / 180);
        ctx.translate(-centerX, -centerY);

        ctx.drawImage(state.imageXCanvas, state.x, state.y, state.width, state.height);

        if (state.isSelected && window.InteractionManager) {
            ctx.strokeStyle = '#00bcd4'; 
            ctx.lineWidth = 2;
            ctx.strokeRect(state.x, state.y, state.width, state.height);

            const handles = window.InteractionManager.getHandlePositions();
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#00bcd4';
            ctx.lineWidth = 2;

            for (let key in handles) {
                const h = handles[key];
                ctx.fillRect(h.x, h.y, state.handleSize, state.handleSize);
                ctx.strokeRect(h.x, h.y, state.handleSize, state.handleSize);
            }
        }
        
        ctx.restore();
    },

    resetStateForCroppedImage: function(newWidth, newHeight) {
        const canvas = document.getElementById('editorCanvas');
        if (!canvas) return;

        window.imgState.width = newWidth;
        window.imgState.height = newHeight;
        window.imgState.rotation = 0;
        window.imgState.x = 0;
        window.imgState.y = 0;

        canvas.width = newWidth;
        canvas.height = newHeight;
    }
};

function resizeCanvasToFit() {
    const canvas = document.getElementById('editorCanvas');
    const canvasArea = document.getElementById('canvas') || document.getElementById('canvasArea');
    if (!canvas || !canvasArea) return;
    canvas.width = canvasArea.clientWidth || 800;
    canvas.height = canvasArea.clientHeight || 600;
}

document.addEventListener("DOMContentLoaded", () => {
    resizeCanvasToFit();
    const dbRequest = indexedDB.open("VisualsDB", 1);
    
    dbRequest.onsuccess = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('images')) return;

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
                    
                    const canvasArea = document.getElementById('canvas') || document.getElementById('canvasArea');
                    const maxDisplayW = canvasArea ? (canvasArea.clientWidth || 800) : 800;
                    const maxDisplayH = canvasArea ? (canvasArea.clientHeight || 600) : 600;

                    const allowedW = maxDisplayW * 0.9;
                    const allowedH = maxDisplayH * 0.9;

                    let displayW = img.width;
                    let displayH = img.height;
                    
                    if (displayW > allowedW || displayH > allowedH) {
                        const scaleX = allowedW / displayW;
                        const scaleY = allowedH / displayH;
                        const fitScale = Math.min(scaleX, scaleY);
                        
                        displayW = Math.round(displayW * fitScale);
                        displayH = Math.round(displayH * fitScale);
                    }

                    window.imgState.x = Math.round((maxDisplayW - displayW) / 2);
                    window.imgState.y = Math.round((maxDisplayH - displayH) / 2);
                    window.imgState.width = displayW;
                    window.imgState.height = displayH;
                    window.imgState.rotation = 0; 
                    window.imgState.isSelected = true;

                    const offscreen = document.createElement('canvas');
                    offscreen.width = img.width; 
                    offscreen.height = img.height;
                    window.imgState.imageXCanvas = offscreen;

                    if (window.CanvasEditor.resetStateForCroppedImage) {
                        window.CanvasEditor.resetStateForCroppedImage(displayW, displayH);
                    }
                    if (window.HistoryManager) {
                        window.HistoryManager.clearToDefaultStates();
                    }
                    window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
                };
            }
        };
    };

    window.addEventListener('editorHistoryChanged', () => {
        if (window.CanvasEditor && typeof window.CanvasEditor.applyEffectsPipeline === 'function') {
            window.CanvasEditor.applyEffectsPipeline();
        }
    });

    document.addEventListener("input", (e) => {
        if (e.target && (e.target.type === "range" || e.target.id === "transformWidthInput" || e.target.id === "transformHeightInput")) {
            if (!window.CanvasEditor.isScrubbing) {
                window.CanvasEditor.isScrubbing = true;
            }
        }
    });

// NEW FIXED: Debounced release listener to prevent high-value click crashes
let pipelineDebounceTimeout = null;

document.addEventListener("change", (e) => {
    if (e.target && (e.target.type === "range" || e.target.id === "transformWidthInput" || e.target.id === "transformHeightInput")) {
        
        // Clear any pending render calls stacked up by a sudden click action
        if (pipelineDebounceTimeout) {
            clearTimeout(pipelineDebounceTimeout);
        }

        // Delay the heavy full-res render by 40ms to let the UI thread breathe
        pipelineDebounceTimeout = setTimeout(() => {
            window.CanvasEditor.isScrubbing = false;
            
            // Force reset the render loop lock state if it got stuck during the click spike
            window.canvasRenderPending = false; 

            if (window.CanvasEditor && typeof window.CanvasEditor.applyEffectsPipeline === 'function') {
                window.CanvasEditor.applyEffectsPipeline();
            }
        }, 40); 
    }
});
});
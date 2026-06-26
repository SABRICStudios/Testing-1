// photo_editor.js - High Performance Live Intercept Matrix Processing
window.imgState = {
    img: null,            
    imageXCanvas: null,   
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    isSelected: false, 
    handleSize: 10
};

window.canvasRenderPending = false;

window.CanvasEditor = {
    isScrubbing: false, // Flag detecting active mobile slider touch interactions
    
    // Persistent memory allocation buffers to prevent garbage collection frame drops
    _kernelCanvasBuffer: null,
    _kernelCtxBuffer: null,

    getState: () => window.imgState,
    
    getWorkingImage: () => {
        const cleanCanvas = document.createElement('canvas');
        if (!window.imgState.img) return cleanCanvas;
        cleanCanvas.width = window.imgState.img.width;
        cleanCanvas.height = window.imgState.img.height;
        const ctx = cleanCanvas.getContext('2d');
        ctx.drawImage(window.imgState.img, 0, 0);
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
                const transformState = configMatrix.transform || { width: 0, height: 0, rotation: 0 };
                
                let baseWidth = transformState.width || originalImg.width;
                let baseHeight = transformState.height || originalImg.height;

                // --- MOBILE PERFORMANCE ENGINE: PREVIEW DOWNSAMPLING ---
                // Capping heavy processing areas at 1024px during active user dragging
                const MAX_PREVIEW_DIM = 1024;
                let scaleFactor = 1;
                if (window.CanvasEditor.isScrubbing && (baseWidth > MAX_PREVIEW_DIM || baseHeight > MAX_PREVIEW_DIM)) {
                    scaleFactor = MAX_PREVIEW_DIM / Math.max(baseWidth, baseHeight);
                }

                const targetWidth = Math.round(baseWidth * scaleFactor);
                const targetHeight = Math.round(baseHeight * scaleFactor);
                const degrees = transformState.rotation || 0;

                const isOrthogonal = (degrees / 90) % 2 !== 0;
                targetCanvas.width = isOrthogonal ? targetHeight : targetWidth;
                targetCanvas.height = isOrthogonal ? targetWidth : targetHeight;

                ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
                ctx.save();
                ctx.translate(targetCanvas.width / 2, targetCanvas.height / 2);
                ctx.rotate((degrees * Math.PI) / 180);

                // Account for downsampling inside the localized coordinate systems
                const renderW = targetWidth;
                const renderH = targetHeight;

                ctx.drawImage(originalImg, -renderW / 2, -renderH / 2, renderW, renderH);
                ctx.restore();

                let imgData = ctx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);

                // --- LINEAR COEFFICIENT CALCULATIONS ---
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

                    data[i]     = r > 255 ? 255 : (r < 0 ? 0 : r);
                    data[i + 1] = g > 255 ? 255 : (g < 0 ? 0 : g);
                    data[i + 2] = b > 255 ? 255 : (b < 0 ? 0 : b);
                } 

                // --- 3. OPTIMIZED CONVOLUTION KERNELS ---
                if (baseline.sharpen !== 0) {
                    imgData = window.CanvasEditor._applySharpenKernel(imgData, baseline.sharpen);
                }

                if (baseline.clarity !== 0) {
                    imgData = window.CanvasEditor._applyClarityKernel(imgData, baseline.clarity);
                }

                ctx.putImageData(imgData, 0, 0);

                // --- VIGNETTE PROCESSING ---
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

    // High performance sharpen using cached canvas contexts to stop GC spikes
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

        // Skip boundary rows to bypass slow edge calculations
        for (let y = 1; y < h - 1; y++) {
            const rowOffset = y * w;
            const prevRowOffset = (y - 1) * w;
            const nextRowOffset = (y + 1) * w;

            for (let x = 1; x < w - 1; x++) {
                const idx = (rowOffset + x) * 4;
                const leftIdx = idx - 4; const rightIdx = idx + 4;
                const topIdx = (prevRowOffset + x) * 4; const btmIdx = (nextRowOffset + x) * 4;

                // Loop unrolling channel assignments for accelerated compilation paths
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

    // Optimized Clarity Kernel featuring spatial strides and local unrolled masks
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
        dst.set(src); // Clone baseline settings down for safety mappings

        const strength = (value / 100) * 0.35;
        const stride = window.CanvasEditor.isScrubbing ? 4 : 2; // Extra loop strides for mobile interaction speeds

        for (let y = 2; y < h - 2; y += stride) {
            const currentYOffset = y * w;
            for (let x = 2; x < w - 2; x += stride) {
                const idx = (currentYOffset + x) * 4;
                
                const centerLuma = 0.299 * src[idx] + 0.587 * src[idx+1] + 0.114 * src[idx+2];
                const leftLuma   = 0.299 * src[idx-8] + 0.587 * src[idx-7] + 0.114 * src[idx-6];
                const rightLuma  = 0.299 * src[idx+8] + 0.587 * src[idx+9] + 0.114 * src[idx+10];
                const localAvg   = (centerLuma + leftLuma + rightLuma) / 3;

                // Scale fill ranges based on active execution steps
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
                    const offscreen = document.createElement('canvas');
                    offscreen.width = img.width; offscreen.height = img.height;
                    window.imgState.imageXCanvas = offscreen;

                    window.CanvasEditor.resetStateForCroppedImage(img.width, img.height);
                    if (window.HistoryManager) window.HistoryManager.clearToDefaultStates();
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
});
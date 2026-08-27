// photo_editor.js - High Performance Live Intercept Matrix Processing (Layer-Aware)
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

    getActiveLayer: () => {
        if (window.LayerManager && typeof window.LayerManager.getActiveLayer === 'function') {
            return window.LayerManager.getActiveLayer();
        }
        return null;
    },

    getState: () => window.imgState,

renderCanvasStack: () => {
    const editorCanvas = document.getElementById('editorCanvas');
    if (!editorCanvas) return;
    const ctx = editorCanvas.getContext('2d');

    ctx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);

    if (window.LayerManager && Array.isArray(window.LayerManager.layers) && window.LayerManager.layers.length > 0) {
        const activeLayer = window.CanvasEditor ? window.CanvasEditor.getActiveLayer() : null;

        // Draw layers from bottom (Background) to top
        const sortedLayers = [...window.LayerManager.layers].reverse();

        sortedLayers.forEach(layer => {
            if (!layer || layer.visible === false) return;

            // 1. Find the drawable source (supports layer.canvas, layer.image, or layer.img)
            const source = layer.canvas || layer.image || layer.img;

            // 2. Ensure source exists and, if it's an Image element, that it's fully loaded
            if (!source) return;
            if (source instanceof HTMLImageElement && (!source.complete || source.naturalWidth === 0)) {
                return; // Image is still loading or broken
            }

            ctx.save();

            // Set opacity and blend modes
            ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1.0;
            if (layer.blendMode) {
                ctx.globalCompositeOperation = layer.blendMode;
            }

            const isActive = activeLayer && activeLayer.id === layer.id;

            // 3. Robust dimension resolution
            const sourceWidth = source.width || source.naturalWidth || 0;
            const sourceHeight = source.height || source.naturalHeight || 0;

            const posX = isActive && window.imgState?.x !== undefined ? window.imgState.x : (layer.x || 0);
            const posY = isActive && window.imgState?.y !== undefined ? window.imgState.y : (layer.y || 0);
            const posW = isActive && window.imgState?.width ? window.imgState.width : (layer.width || sourceWidth);
            const posH = isActive && window.imgState?.height ? window.imgState.height : (layer.height || sourceHeight);
            const rot = isActive && window.imgState?.rotation !== undefined ? window.imgState.rotation : (layer.rotation || 0);

            // Skip rendering if dimensions are zero
            if (posW <= 0 || posH <= 0) {
                ctx.restore();
                return;
            }

            // Apply rotation around center point
            if (rot) {
                const cx = posX + posW / 2;
                const cy = posY + posH / 2;
                ctx.translate(cx, cy);
                ctx.rotate((rot * Math.PI) / 180);
                ctx.translate(-cx, -cy);
            }

            // Draw image/canvas element
            ctx.drawImage(source, posX, posY, posW, posH);

            ctx.restore();
        });
    } else if (window.imgState && window.imgState.imageXCanvas) {
        // Fallback for single image mode
        const fallbackSource = window.imgState.imageXCanvas;
        
        if (fallbackSource instanceof HTMLImageElement && !fallbackSource.complete) return;

        ctx.drawImage(
            fallbackSource,
            window.imgState.x || 0,
            window.imgState.y || 0,
            window.imgState.width || fallbackSource.width || 0,
            window.imgState.height || fallbackSource.height || 0
        );
    }
},
    
    getWorkingImage: () => {
        const cleanCanvas = document.createElement('canvas');
        const activeLayer = window.CanvasEditor.getActiveLayer();
        const source = activeLayer ? activeLayer.canvas : window.imgState.imageXCanvas;
        
        if (!source) return cleanCanvas;
        cleanCanvas.width = source.width;
        cleanCanvas.height = source.height;
        
        const ctx = cleanCanvas.getContext('2d');
        const state = window.imgState;
        
        ctx.save();
        ctx.translate(state.x + state.width / 2, state.y + state.height / 2);
        if (state.rotation) {
            ctx.rotate((state.rotation * Math.PI) / 180);
        }
        
        ctx.drawImage(
            source, 
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

        const activeLayer = window.CanvasEditor.getActiveLayer();
        const sourceImg = activeLayer ? (activeLayer.sourceImage || activeLayer.originalCanvas || activeLayer.canvas) : window.imgState.img;
        const targetCanvas = activeLayer ? activeLayer.canvas : window.imgState.imageXCanvas;

        if (!sourceImg || !targetCanvas) return;

        window.canvasRenderPending = true;

        requestAnimationFrame(() => {
            try {
                const ctx = targetCanvas.getContext('2d');
                if (!window.HistoryManager) {
                    window.canvasRenderPending = false;
                    return;
                }
                
                const configMatrix = (activeLayer && activeLayer.parameters) 
                    ? activeLayer.parameters 
                    : window.HistoryManager.getCurrentParameters();

                const transformState = configMatrix.transform || {};
                
                let baseWidth = parseInt(window.imgState.width, 10) || parseInt(transformState.width, 10) || sourceImg.naturalWidth || sourceImg.width;
                let baseHeight = parseInt(window.imgState.height, 10) || parseInt(transformState.height, 10) || sourceImg.naturalHeight || sourceImg.height;
                const degrees = window.imgState.rotation !== undefined ? parseFloat(window.imgState.rotation) : (parseFloat(transformState.rotation) || 0);

                targetCanvas.width = baseWidth;
                targetCanvas.height = baseHeight;
                window.imgState.rotation = degrees;

                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
                
                ctx.drawImage(sourceImg, 0, 0, baseWidth, baseHeight);

                let imgData;
                const MAX_PREVIEW_DIM = 1024;
                
                if (window.CanvasEditor.isScrubbing && (baseWidth > MAX_PREVIEW_DIM || baseHeight > MAX_PREVIEW_DIM)) {
                    const scaleFactor = MAX_PREVIEW_DIM / Math.max(baseWidth, baseHeight);
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = Math.round(baseWidth * scaleFactor);
                    tempCanvas.height = Math.round(baseHeight * scaleFactor);
                    
                    const tempCtx = tempCanvas.getContext('2d');
                    tempCtx.drawImage(sourceImg, 0, 0, tempCanvas.width, tempCanvas.height);
                    imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                } else {
                    imgData = ctx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
                }

                // --- CAPTURE PRISTINE UNTOUCHED BACKING PIXELS FOR SELECTION BLENDING ---
                // Match pristine canvas resolution to imgData so array dimensions never mismatch during scrubbing
                const pristineCanvas = document.createElement('canvas');
                pristineCanvas.width = imgData.width;
                pristineCanvas.height = imgData.height;
                const pristineCtx = pristineCanvas.getContext('2d');
                pristineCtx.drawImage(sourceImg, 0, 0, pristineCanvas.width, pristineCanvas.height);
                const pristineImageData = pristineCtx.getImageData(0, 0, pristineCanvas.width, pristineCanvas.height);

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
                const currentW = imgData.width;
                const currentH = imgData.height;

             // --- SELECTION MASK RESOLUTION ---
                // Active mask evaluates regardless of full screen or minimized state
                const selectionMask = window.selectionProcessingActive ? window.activeSelectionMask : null;
                const isSelectionActive = !!(window.selectionProcessingActive && selectionMask && selectionMask.data && selectionMask.data.length > 0);
                const maskData = isSelectionActive ? selectionMask.data : null;
                const maskWidth = isSelectionActive ? selectionMask.width : currentW;
                const maskHeight = isSelectionActive ? selectionMask.height : currentH;
                const bounds = isSelectionActive ? selectionMask.bounds : null;

                const hasExposure   = scalar.exposure !== 0;
                const hasBrightness = scalar.brightness !== 0;
                const hasContrast   = scalar.contrast !== 0;
                const hasSaturation = scalar.saturation !== 0;
                const hasTempTint   = scalar.temperature !== 0 || scalar.tint !== 0;
                const hasHighlights = baseline.highlights !== 0;
                const hasShadows    = baseline.shadows !== 0;
                const hasVibrance   = baseline.vibrance !== 0;

                const expFactor        = hasExposure ? Math.pow(2, scalar.exposure) : 1;
                const bright           = scalar.brightness;
                const cFactor          = hasContrast ? (259 * (scalar.contrast + 255)) / (255 * (259 - scalar.contrast)) : 1;
                const saturationFactor = (scalar.saturation + 100) / 100;
                const tempOffset       = scalar.temperature * 0.4;
                const tintOffset       = scalar.tint * 0.4;

                const highFactor     = baseline.highlights / 100;
                const shadowFactor   = baseline.shadows / 100;
                const vibFactor      = baseline.vibrance / 100;

              // --- PRIMARY PIXEL EDITING LOOP (WITH SELECTION MASK BLENDING) ---
                for (let i = 0; i < len; i += 4) {
                    const origR = data[i];
                    const origG = data[i + 1];
                    const origB = data[i + 2];

                    let maskAlpha = 1.0; // Default to full effect strength across the entire canvas

if (isSelectionActive && maskData) {
                        const pixelIdx = i / 4;
                        const px = pixelIdx % currentW;
                        const py = Math.floor(pixelIdx / currentW);

                        const maskX = Math.floor((px / currentW) * maskWidth);
                        const maskY = Math.floor((py / currentH) * maskHeight);

                        // Fast bounding check: Skip pixel modifications if outside selection box
                        if (bounds && (maskX < bounds.x || maskX >= bounds.x + bounds.width || maskY < bounds.y || maskY >= bounds.y + bounds.height)) {
                            maskAlpha = 0;
                        } else {
                            const maskIdx = (maskY * maskWidth + maskX) * 4;
                            maskAlpha = (maskData[maskIdx + 3] || maskData[maskIdx]) / 255;
                        }

                        // If pixel is outside the active selection mask, leave original data intact and skip pipeline
                        if (maskAlpha === 0) {
                            data[i]     = origR;
                            data[i + 1] = origG;
                            data[i + 2] = origB;
                            continue;
                        }
                    }

                    let r = origR; let g = origG; let b = origB;

                    // --- APPLY ADJUSTMENT PIPELINE ---
                    if (hasExposure)   { r *= expFactor; g *= expFactor; b *= expFactor; }
                    if (hasBrightness) { r += bright; g += bright; b += bright; }
                    if (hasContrast)   { r = cFactor * (r - 128) + 128; g = cFactor * (g - 128) + 128; b = cFactor * (b - 128) + 128; }
                    
                    if (hasSaturation) {
                        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
                        r = luma + (r - luma) * saturationFactor; 
                        g = luma + (g - luma) * saturationFactor; 
                        b = luma + (b - luma) * saturationFactor;
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

                    if (window.CurvesManager && window.CurvesManager.activeState && window.CurvesManager.activeState.active) {
                        const lut = window.CurvesManager.activeState;
                        if (lut.lutR) r = lut.lutR[Math.round(r > 255 ? 255 : (r < 0 ? 0 : r))];
                        if (lut.lutG) g = lut.lutG[Math.round(g > 255 ? 255 : (g < 0 ? 0 : g))];
                        if (lut.lutB) b = lut.lutB[Math.round(b > 255 ? 255 : (b < 0 ? 0 : b))];
                    }

                    // Clamp intermediate values
                    r = r > 255 ? 255 : (r < 0 ? 0 : r);
                    g = g > 255 ? 255 : (g < 0 ? 0 : g); 
                    b = b > 255 ? 255 : (b < 0 ? 0 : b);

                    // --- MASK ALPHA BLENDING ---
                    // Linearly interpolate between untouched pixel and adjusted pixel based on selection mask strength
                    data[i]     = Math.round(origR + (r - origR) * maskAlpha);
                    data[i + 1] = Math.round(origG + (g - origG) * maskAlpha);
                    data[i + 2] = Math.round(origB + (b - origB) * maskAlpha);
                }

                let processedImgData = imgData;

                if (typeof processColorGradingPixelData === 'function') {
                    processedImgData = processColorGradingPixelData(processedImgData);
                }

                if (configMatrix.filter && configMatrix.filter.type !== 'none' && window.FilterEngine) {
                    processedImgData = window.FilterEngine.process(processedImgData, configMatrix.filter.type, configMatrix.filter.intensity);
                }

                if (configMatrix.details && window.DetailsEngine && typeof window.DetailsEngine.process === 'function') {
                    processedImgData = window.DetailsEngine.process(processedImgData, configMatrix.details);
                }

                const gaussianInput = document.getElementById('gaussianSlider');
                const radialInput = document.getElementById('radialSlider');

                const radius = gaussianInput ? parseFloat(gaussianInput.value) : (configMatrix.blur?.gaussian || 0);
                const intensity = radialInput ? parseInt(radialInput.value, 10) : (configMatrix.blur?.radial || 0);

                if (radius > 0 && typeof BlurFilters !== 'undefined' && BlurFilters.applyGaussian) {
                    processedImgData = BlurFilters.applyGaussian(processedImgData, radius);
                }

                if (intensity > 0 && typeof BlurFilters !== 'undefined' && BlurFilters.applyRadialDepth) {
                    processedImgData = BlurFilters.applyRadialDepth(processedImgData, intensity);
                }

                if (baseline.sharpen !== 0) {
                    processedImgData = window.CanvasEditor._applySharpenKernel(processedImgData, baseline.sharpen);
                }

                if (baseline.clarity !== 0) {
                    processedImgData = window.CanvasEditor._applyClarityKernel(processedImgData, baseline.clarity);
                }


                imgData = processedImgData;

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

                window.CanvasEditor.renderCanvasStack();

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

        if (!state.img && (!window.LayerManager || window.LayerManager.layers.length === 0)) return;

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

        if (typeof window.initLayersEngine === 'function') {
            window.initLayersEngine();
        }

        if (window.LayerManager && window.LayerManager.layers && window.LayerManager.layers.length > 0) {
            window.CanvasEditor.renderCanvasStack();
        } else if (state.imageXCanvas) {
            ctx.save();
            const centerX = state.x + state.width / 2;
            const centerY = state.y + state.height / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate(((state.rotation || 0) * Math.PI) / 180);
            ctx.translate(-centerX, -centerY);

            ctx.drawImage(state.imageXCanvas, state.x, state.y, state.width, state.height);
            ctx.restore();
        }

        // --- DRAW SELECTION BORDER AND HANDLES INSIDE ROTATED MATRIX ---
        if (state.isSelected) {
            ctx.save();
            const centerX = state.x + state.width / 2;
            const centerY = state.y + state.height / 2;

            ctx.translate(centerX, centerY);
            ctx.rotate(((state.rotation || 0) * Math.PI) / 180);

            // Bounding Box (centered around 0,0)
            ctx.strokeStyle = '#00bcd4'; 
            ctx.lineWidth = 2;
            ctx.strokeRect(-state.width / 2, -state.height / 2, state.width, state.height);

            // Interactive Corner Handles (centered around 0,0)
            const hs = state.handleSize || 10;
            const halfW = state.width / 2;
            const halfH = state.height / 2;

            const handleCoords = [
                { x: -halfW - hs / 2, y: -halfH - hs / 2 }, // Top-Left
                { x: halfW - hs / 2,  y: -halfH - hs / 2 }, // Top-Right
                { x: -halfW - hs / 2, y: halfH - hs / 2 },  // Bottom-Left
                { x: halfW - hs / 2,  y: halfH - hs / 2 }   // Bottom-Right
            ];

            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#00bcd4';
            ctx.lineWidth = 2;

            handleCoords.forEach(h => {
                ctx.fillRect(h.x, h.y, hs, hs);
                ctx.strokeRect(h.x, h.y, hs, hs);
            });

            ctx.restore();
        }
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

                    // --- ADD THIS BLOCK TO BIND TO BACKGROUND LAYER ---
                   const bgLayer = window.LayerManager && Array.isArray(window.LayerManager.layers) 
                    ? window.LayerManager.layers.find(l => l.id === 1 || l.id === 'bg') 
                    : null;
                    if (bgLayer) {
                        bgLayer.canvas = offscreen;
                        bgLayer.sourceImage = img;
                    }


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

    let pipelineDebounceTimeout = null;

    document.addEventListener("change", (e) => {
        if (e.target && (e.target.type === "range" || e.target.id === "transformWidthInput" || e.target.id === "transformHeightInput")) {
            if (pipelineDebounceTimeout) {
                clearTimeout(pipelineDebounceTimeout);
            }

            pipelineDebounceTimeout = setTimeout(() => {
                window.CanvasEditor.isScrubbing = false;
                window.canvasRenderPending = false; 

                if (window.CanvasEditor && typeof window.CanvasEditor.applyEffectsPipeline === 'function') {
                    window.CanvasEditor.applyEffectsPipeline();
                }
            }, 40); 
        }
    });
});
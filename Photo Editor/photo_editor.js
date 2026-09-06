// photo_editor.js - High Performance Live Intercept Matrix Processing (Layer-Aware + Selection-Aware)
(function () {
'use strict';

const DEFAULT_SCALAR = {
    exposure: 0,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    tint: 0
};

const DEFAULT_BASELINE = {
    highlights: 0,
    shadows: 0,
    clarity: 0,
    sharpen: 0,
    vibrance: 0,
    vignette: 0
};

function createDefaultSelectionAdjustmentState() {
    return {
        global: {
            scalar: { ...DEFAULT_SCALAR },
            baseline: { ...DEFAULT_BASELINE }
        },
        local: {
            scalar: { ...DEFAULT_SCALAR },
            baseline: { ...DEFAULT_BASELINE }
        }
    };
}

function ensureSelectionAdjustmentState() {
    if (!window.SelectionAdjustmentState || typeof window.SelectionAdjustmentState !== 'object') {
        window.SelectionAdjustmentState = createDefaultSelectionAdjustmentState();
    }

    if (!window.SelectionAdjustmentState.global || typeof window.SelectionAdjustmentState.global !== 'object') {
        window.SelectionAdjustmentState.global = {};
    }

    if (!window.SelectionAdjustmentState.local || typeof window.SelectionAdjustmentState.local !== 'object') {
        window.SelectionAdjustmentState.local = {};
    }

    if (!window.SelectionAdjustmentState.global.scalar) {
        window.SelectionAdjustmentState.global.scalar = { ...DEFAULT_SCALAR };
    }

    if (!window.SelectionAdjustmentState.global.baseline) {
        window.SelectionAdjustmentState.global.baseline = { ...DEFAULT_BASELINE };
    }

    if (!window.SelectionAdjustmentState.local.scalar) {
        window.SelectionAdjustmentState.local.scalar = { ...DEFAULT_SCALAR };
    }

    if (!window.SelectionAdjustmentState.local.baseline) {
        window.SelectionAdjustmentState.local.baseline = { ...DEFAULT_BASELINE };
    }

    return window.SelectionAdjustmentState;
}

function getNumericValue(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeScalar(source) {
    const result = { ...DEFAULT_SCALAR };

    if (!source || typeof source !== 'object') return result;

    Object.keys(result).forEach(key => {
        result[key] = getNumericValue(source[key], result[key]);
    });

    return result;
}

function normalizeBaseline(source) {
    const result = { ...DEFAULT_BASELINE };

    if (!source || typeof source !== 'object') return result;

    Object.keys(result).forEach(key => {
        result[key] = getNumericValue(source[key], result[key]);
    });

    return result;
}

window.imgState = window.imgState || {
    img: null,
    imageXCanvas: null,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
    isSelected: false,
    handleSize: 10,
    maintainAspectRatio: false,
    localParameters: { ...DEFAULT_SCALAR }
};

window.imgState.localParameters = {
    ...DEFAULT_SCALAR,
    ...(window.imgState.localParameters || {})
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

    getSelectionState: () => ensureSelectionAdjustmentState(),

    getSelectionMask: () => {
        const mask = window.activeSelectionMask;
        if (!mask || !mask.data || !mask.data.length) return null;
        return mask;
    },

    getSourceForLayer: (layer, targetCanvas) => {
        if (!layer) return null;

        const source = layer.sourceImage || layer.originalCanvas || layer.originalImage || layer.canvas || layer.image || layer.img;

        if (!source) return null;

        if (source === targetCanvas && targetCanvas.width > 0 && targetCanvas.height > 0) {
            const snapshot = document.createElement('canvas');
            snapshot.width = targetCanvas.width;
            snapshot.height = targetCanvas.height;

            const snapshotCtx = snapshot.getContext('2d');

            if (snapshotCtx) {
                snapshotCtx.drawImage(targetCanvas, 0, 0);
                return snapshot;
            }
        }

        return source;
    },

    renderCanvasStack: () => {
        const editorCanvas = document.getElementById('editorCanvas');
        if (!editorCanvas) return;

        const ctx = editorCanvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);

        if (window.LayerManager && Array.isArray(window.LayerManager.layers) && window.LayerManager.layers.length > 0) {
            const activeLayer = window.CanvasEditor.getActiveLayer();

            const sortedLayers = [...window.LayerManager.layers].reverse();

            sortedLayers.forEach(layer => {
                if (!layer || layer.visible === false) return;

                const source = layer.canvas || layer.image || layer.img;

                if (!source) return;

                if (source instanceof HTMLImageElement && (!source.complete || source.naturalWidth === 0)) {
                    return;
                }

                if (source instanceof HTMLCanvasElement && (source.width <= 0 || source.height <= 0)) {
                    return;
                }

                ctx.save();

                ctx.globalAlpha = layer.opacity !== undefined ? getNumericValue(layer.opacity, 1) : 1;

                if (layer.blendMode) {
                    try {
                        ctx.globalCompositeOperation = layer.blendMode;
                    } catch (e) {
                        ctx.globalCompositeOperation = 'source-over';
                    }
                } else {
                    ctx.globalCompositeOperation = 'source-over';
                }

                const isActive = activeLayer && activeLayer.id === layer.id;

                const sourceWidth = source.width || source.naturalWidth || 0;
                const sourceHeight = source.height || source.naturalHeight || 0;

                const posX = isActive && window.imgState && Number.isFinite(Number(window.imgState.x)) ? Number(window.imgState.x) : getNumericValue(layer.x, 0);
                const posY = isActive && window.imgState && Number.isFinite(Number(window.imgState.y)) ? Number(window.imgState.y) : getNumericValue(layer.y, 0);
                const posW = isActive && window.imgState && Number(window.imgState.width) > 0 ? Number(window.imgState.width) : getNumericValue(layer.width, sourceWidth);
                const posH = isActive && window.imgState && Number(window.imgState.height) > 0 ? Number(window.imgState.height) : getNumericValue(layer.height, sourceHeight);
                const rot = isActive && window.imgState && Number.isFinite(Number(window.imgState.rotation)) ? Number(window.imgState.rotation) : getNumericValue(layer.rotation, 0);

                if (posW <= 0 || posH <= 0) {
                    ctx.restore();
                    return;
                }

                if (rot) {
                    const cx = posX + posW / 2;
                    const cy = posY + posH / 2;
                    ctx.translate(cx, cy);
                    ctx.rotate((rot * Math.PI) / 180);
                    ctx.translate(-cx, -cy);
                }

                try {
                    ctx.drawImage(source, posX, posY, posW, posH);
                } catch (error) {
                    console.warn('Layer render failed:', error);
                }

                ctx.restore();
            });
        } else if (window.imgState && window.imgState.imageXCanvas) {
            const fallbackSource = window.imgState.imageXCanvas;

            if (fallbackSource instanceof HTMLImageElement && (!fallbackSource.complete || fallbackSource.naturalWidth === 0)) {
                return;
            }

            if (fallbackSource.width <= 0 || fallbackSource.height <= 0) return;

            ctx.save();

            const x = getNumericValue(window.imgState.x, 0);
            const y = getNumericValue(window.imgState.y, 0);
            const width = getNumericValue(window.imgState.width, fallbackSource.width);
            const height = getNumericValue(window.imgState.height, fallbackSource.height);
            const rotation = getNumericValue(window.imgState.rotation, 0);

            const centerX = x + width / 2;
            const centerY = y + height / 2;

            ctx.translate(centerX, centerY);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.translate(-centerX, -centerY);

            ctx.drawImage(fallbackSource, x, y, width, height);

            ctx.restore();
        }
    },

    getWorkingImage: () => {
        const cleanCanvas = document.createElement('canvas');
        const activeLayer = window.CanvasEditor.getActiveLayer();
        const source = activeLayer ? (activeLayer.sourceImage || activeLayer.originalCanvas || activeLayer.canvas) : window.imgState.imageXCanvas;

        if (!source) return cleanCanvas;

        const sourceWidth = source.width || source.naturalWidth || 0;
        const sourceHeight = source.height || source.naturalHeight || 0;

        if (sourceWidth <= 0 || sourceHeight <= 0) return cleanCanvas;

        cleanCanvas.width = sourceWidth;
        cleanCanvas.height = sourceHeight;

        const ctx = cleanCanvas.getContext('2d');
        if (!ctx) return cleanCanvas;

        const state = window.imgState;

        const width = getNumericValue(state.width, sourceWidth);
        const height = getNumericValue(state.height, sourceHeight);
        const x = getNumericValue(state.x, 0);
        const y = getNumericValue(state.y, 0);
        const rotation = getNumericValue(state.rotation, 0);

        ctx.save();

        ctx.translate(x + width / 2, y + height / 2);

        if (rotation) {
            ctx.rotate((rotation * Math.PI) / 180);
        }

        ctx.drawImage(source, -width / 2, -height / 2, width, height);

        ctx.restore();

        return cleanCanvas;
    },

applyEffectsPipeline: () => {
    if (window.canvasRenderPending) return;

    ensureSelectionAdjustmentState();

    const activeLayer = window.CanvasEditor.getActiveLayer();
    let targetCanvas = activeLayer ? activeLayer.canvas : window.imgState.imageXCanvas;

    if (!targetCanvas) {
        targetCanvas = document.createElement('canvas');
        if (activeLayer) {
            activeLayer.canvas = targetCanvas;
        } else {
            window.imgState.imageXCanvas = targetCanvas;
        }
    }

    let sourceImg = activeLayer ? window.CanvasEditor.getSourceForLayer(activeLayer, targetCanvas) : window.imgState.img;
    if (!sourceImg && window.imgState.img) {
        sourceImg = window.imgState.img;
    }

    if (!sourceImg) {
        console.warn('CanvasEditor: no source image available for processing.');
        return;
    }

    const sourceWidth = sourceImg.width || sourceImg.naturalWidth || 0;
    const sourceHeight = sourceImg.height || sourceImg.naturalHeight || 0;

    if (sourceWidth <= 0 || sourceHeight <= 0) {
        console.warn('CanvasEditor: source image has invalid dimensions.');
        return;
    }

    window.canvasRenderPending = true;

    requestAnimationFrame(() => {
        try {
            if (!window.HistoryManager) {
                window.canvasRenderPending = false;
                return;
            }

            const selectionState = ensureSelectionAdjustmentState();
            let configMatrix = null;

            if (activeLayer && activeLayer.parameters) {
                configMatrix = activeLayer.parameters;
            } else if (typeof window.HistoryManager.getCurrentParameters === 'function') {
                configMatrix = window.HistoryManager.getCurrentParameters();
            }

            if (!configMatrix || typeof configMatrix !== 'object') {
                configMatrix = {};
            }

            const transformState = configMatrix.transform && typeof configMatrix.transform === 'object' ? configMatrix.transform : {};

            let baseWidth = parseInt(window.imgState.width, 10) || parseInt(transformState.width, 10) || sourceWidth;
            let baseHeight = parseInt(window.imgState.height, 10) || parseInt(transformState.height, 10) || sourceHeight;

            if (baseWidth <= 0) baseWidth = sourceWidth;
            if (baseHeight <= 0) baseHeight = sourceHeight;

            const degrees = window.imgState.rotation !== undefined ? getNumericValue(window.imgState.rotation, 0) : getNumericValue(transformState.rotation, 0);
            window.imgState.rotation = degrees;

            // Offscreen processing canvas to prevent destructive mutation loops
            const procCanvas = document.createElement('canvas');
            const MAX_PREVIEW_DIM = 1024;
            const isScrubbingPreview = window.CanvasEditor.isScrubbing && (baseWidth > MAX_PREVIEW_DIM || baseHeight > MAX_PREVIEW_DIM);

            if (isScrubbingPreview) {
                const scaleFactor = MAX_PREVIEW_DIM / Math.max(baseWidth, baseHeight);
                procCanvas.width = Math.max(1, Math.round(baseWidth * scaleFactor));
                procCanvas.height = Math.max(1, Math.round(baseHeight * scaleFactor));
            } else {
                procCanvas.width = baseWidth;
                procCanvas.height = baseHeight;
            }

            const procCtx = procCanvas.getContext('2d', { willReadFrequently: true });
            if (!procCtx) {
                window.canvasRenderPending = false;
                return;
            }

            procCtx.imageSmoothingEnabled = true;
            procCtx.imageSmoothingQuality = 'high';
            procCtx.drawImage(sourceImg, 0, 0, procCanvas.width, procCanvas.height);

            let imgData = procCtx.getImageData(0, 0, procCanvas.width, procCanvas.height);
            if (!imgData || !imgData.data || !imgData.data.length) {
                console.warn('CanvasEditor: image data could not be created.');
                window.canvasRenderPending = false;
                return;
            }

            const pristineCanvas = document.createElement('canvas');
            pristineCanvas.width = imgData.width;
            pristineCanvas.height = imgData.height;

            const pristineCtx = pristineCanvas.getContext('2d', { willReadFrequently: true });
            pristineCtx.drawImage(sourceImg, 0, 0, pristineCanvas.width, pristineCanvas.height);

            const pristineImageData = pristineCtx.getImageData(0, 0, pristineCanvas.width, pristineCanvas.height);

            let scalar = normalizeScalar(configMatrix.scalar);
            let baseline = normalizeBaseline(configMatrix.baseline);

            if (window.ParameterHistory && window.ParameterHistory.values) {
                const scalarKeys = Object.keys(DEFAULT_SCALAR);
                scalarKeys.forEach(key => {
                    if (window.ParameterHistory.values[key] !== undefined) {
                        scalar[key] = getNumericValue(window.ParameterHistory.values[key], scalar[key]);
                    }
                });
            }

            if (window.BaselineHistory && typeof window.BaselineHistory.getActiveState === 'function') {
                const liveBaseline = window.BaselineHistory.getActiveState();
                if (liveBaseline && liveBaseline.toolValues) {
                    baseline = normalizeBaseline(liveBaseline.toolValues);
                }
            }

            let selectionMask = window.activeSelectionMask || null;
            const isSelectionActive = !!(
                selectionMask &&
                selectionMask.data &&
                selectionMask.data.length > 0 &&
                selectionMask.width > 0 &&
                selectionMask.height > 0
            );

            if (isSelectionActive) {
                selectionState.local.scalar = { ...scalar };
                selectionState.local.baseline = { ...baseline };
            } else {
                selectionState.global.scalar = { ...scalar };
                selectionState.global.baseline = { ...baseline };
            }

            const globalScalar = normalizeScalar(selectionState.global.scalar);
            const globalBaseline = normalizeBaseline(selectionState.global.baseline);

            const localScalar = normalizeScalar(selectionState.local.scalar);
            const localBaseline = normalizeBaseline(selectionState.local.baseline);

            let maskData = null;
            let maskWidth = 0;
            let maskHeight = 0;
            let bounds = null;

            if (isSelectionActive) {
                maskData = selectionMask.data;
                maskWidth = Number(selectionMask.width) || 0;
                maskHeight = Number(selectionMask.height) || 0;
                bounds = selectionMask.bounds || null;

                if (maskWidth <= 0 || maskHeight <= 0) {
                    selectionMask = null;
                    maskData = null;
                }
            }

            const data = imgData.data;
            const pristineData = pristineImageData.data;
            const len = data.length;
            const currentW = imgData.width;
            const currentH = imgData.height;

            const globalExposure = globalScalar.exposure;
            const globalBrightness = globalScalar.brightness;
            const globalContrast = globalScalar.contrast;
            const globalSaturation = globalScalar.saturation;
            const globalTemperature = globalScalar.temperature;
            const globalTint = globalScalar.tint;

            const globalHighlights = globalBaseline.highlights;
            const globalShadows = globalBaseline.shadows;
            const globalVibrance = globalBaseline.vibrance;

            const localExposure = localScalar.exposure;
            const localBrightness = localScalar.brightness;
            const localContrast = localScalar.contrast;
            const localSaturation = localScalar.saturation;
            const localTemperature = localScalar.temperature;
            const localTint = localScalar.tint;

            const localHighlights = localBaseline.highlights;
            const localShadows = localBaseline.shadows;
            const localVibrance = localBaseline.vibrance;

            const hasAnyLocalAdjustment = localExposure !== 0 || localBrightness !== 0 || localContrast !== 0 || localSaturation !== 0 || localTemperature !== 0 || localTint !== 0 || localHighlights !== 0 || localShadows !== 0 || localVibrance !== 0;
            const hasCurves = !!(window.CurvesManager && window.CurvesManager.activeState && window.CurvesManager.activeState.active);

            for (let i = 0; i < len; i += 4) {
                const origR = pristineData[i];
                const origG = pristineData[i + 1];
                const origB = pristineData[i + 2];
                const alpha = pristineData[i + 3];

                let maskAlpha = 0;

                if (isSelectionActive && maskData && hasAnyLocalAdjustment) {
                    const pixelIndex = i / 4;
                    const px = pixelIndex % currentW;
                    const py = Math.floor(pixelIndex / currentW);

                    const maskX = Math.min(maskWidth - 1, Math.max(0, Math.floor((px / currentW) * maskWidth)));
                    const maskY = Math.min(maskHeight - 1, Math.max(0, Math.floor((py / currentH) * maskHeight)));

                    let insideBounds = true;

                    if (bounds) {
                        const bx = getNumericValue(bounds.x, 0);
                        const by = getNumericValue(bounds.y, 0);
                        const bw = getNumericValue(bounds.width, maskWidth);
                        const bh = getNumericValue(bounds.height, maskHeight);

                        insideBounds = maskX >= bx && maskX < bx + bw && maskY >= by && maskY < by + bh;
                    }

                    if (insideBounds) {
                        const maskIndex = (maskY * maskWidth + maskX) * 4;
                        if (maskIndex >= 0 && maskIndex + 3 < maskData.length) {
                            if (maskData.length >= maskWidth * maskHeight * 4) {
                                maskAlpha = getNumericValue(maskData[maskIndex + 3], 0) / 255;
                            } else {
                                maskAlpha = getNumericValue(maskData[maskY * maskWidth + maskX], 0) / 255;
                            }
                        }
                    }

                    if (!Number.isFinite(maskAlpha)) maskAlpha = 0;
                    maskAlpha = Math.max(0, Math.min(1, maskAlpha));
                }

                const effectiveExposure = globalExposure + localExposure * maskAlpha;
                const effectiveBrightness = globalBrightness + localBrightness * maskAlpha;
                const effectiveContrast = globalContrast + localContrast * maskAlpha;
                const effectiveSaturation = globalSaturation + localSaturation * maskAlpha;
                const effectiveTemperature = globalTemperature + localTemperature * maskAlpha;
                const effectiveTint = globalTint + localTint * maskAlpha;

                const effectiveHighlights = globalHighlights + localHighlights * maskAlpha;
                const effectiveShadows = globalShadows + localShadows * maskAlpha;
                const effectiveVibrance = globalVibrance + localVibrance * maskAlpha;

                let r = origR;
                let g = origG;
                let b = origB;

                if (effectiveExposure !== 0) {
                    const exposureFactor = Math.pow(2, effectiveExposure);
                    r *= exposureFactor;
                    g *= exposureFactor;
                    b *= exposureFactor;
                }

                if (effectiveBrightness !== 0) {
                    r += effectiveBrightness;
                    g += effectiveBrightness;
                    b += effectiveBrightness;
                }

                if (effectiveContrast !== 0) {
                    const contrastFactor = (259 * (effectiveContrast + 255)) / (255 * (259 - effectiveContrast));
                    r = contrastFactor * (r - 128) + 128;
                    g = contrastFactor * (g - 128) + 128;
                    b = contrastFactor * (b - 128) + 128;
                }

                if (effectiveSaturation !== 0) {
                    const saturationFactor = (effectiveSaturation + 100) / 100;
                    const luma = 0.299 * r + 0.587 * g + 0.114 * b;

                    r = luma + (r - luma) * saturationFactor;
                    g = luma + (g - luma) * saturationFactor;
                    b = luma + (b - luma) * saturationFactor;
                }

                if (effectiveTemperature !== 0 || effectiveTint !== 0) {
                    const temperatureOffset = effectiveTemperature * 0.4;
                    const tintOffset = effectiveTint * 0.4;

                    r += temperatureOffset;
                    g += tintOffset;
                    b -= temperatureOffset;
                }

                if (effectiveHighlights !== 0 || effectiveShadows !== 0 || effectiveVibrance !== 0) {
                    const luma = 0.299 * r + 0.587 * g + 0.114 * b;

                    if (effectiveHighlights !== 0 && luma > 128) {
                        const highlightFactor = effectiveHighlights / 100;
                        const weight = Math.pow((luma - 128) / 127, 2);
                        const diff = highlightFactor * 40 * weight;

                        r += diff;
                        g += diff;
                        b += diff;
                    }

                    if (effectiveShadows !== 0 && luma < 128) {
                        const shadowFactor = effectiveShadows / 100;
                        const weight = Math.pow((128 - luma) / 128, 2);
                        const diff = shadowFactor * 40 * weight;

                        r += diff;
                        g += diff;
                        b += diff;
                    }

                    if (effectiveVibrance !== 0) {
                        const maxChannel = Math.max(r, g, b);
                        const minChannel = Math.min(r, g, b);
                        const avg = (r + g + b) / 3;
                        const saturation = maxChannel - minChannel;
                        const vibranceFactor = effectiveVibrance / 100;
                        const amount = Math.min(1, Math.abs(maxChannel - avg) * 2 / 255 * Math.abs(vibranceFactor));

                        if (vibranceFactor >= 0) {
                            r += (maxChannel - r) * amount;
                            g += (maxChannel - g) * amount;
                            b += (maxChannel - b) * amount;
                        } else if (saturation > 0) {
                            r = avg + (r - avg) * (1 - amount);
                            g = avg + (g - avg) * (1 - amount);
                            b = avg + (b - avg) * (1 - amount);
                        }
                    }
                }

                if (hasCurves) {
                    const curves = window.CurvesManager.activeState;
                    const safeR = Math.max(0, Math.min(255, Math.round(r)));
                    const safeG = Math.max(0, Math.min(255, Math.round(g)));
                    const safeB = Math.max(0, Math.min(255, Math.round(b)));

                    if (curves.lutR && curves.lutR[safeR] !== undefined) r = curves.lutR[safeR];
                    if (curves.lutG && curves.lutG[safeG] !== undefined) g = curves.lutG[safeG];
                    if (curves.lutB && curves.lutB[safeB] !== undefined) b = curves.lutB[safeB];
                }

                data[i] = Math.max(0, Math.min(255, Math.round(r)));
                data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
                data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
                data[i + 3] = alpha;
            }

            let processedImgData = imgData;

            if (typeof processColorGradingPixelData === 'function') {
                processedImgData = processColorGradingPixelData(processedImgData) || processedImgData;
            }

            if (configMatrix.filter && configMatrix.filter.type && configMatrix.filter.type !== 'none' && window.FilterEngine && typeof window.FilterEngine.process === 'function') {
                processedImgData = window.FilterEngine.process(processedImgData, configMatrix.filter.type, configMatrix.filter.intensity) || processedImgData;
            }

            let detailsConfig = configMatrix.details;
            if (!detailsConfig && window.DetailsManager && window.DetailsManager.activeState) {
                detailsConfig = window.DetailsManager.activeState;
            }
            if (detailsConfig && window.DetailsEngine && typeof window.DetailsEngine.process === 'function') {
                processedImgData = window.DetailsEngine.process(processedImgData, detailsConfig) || processedImgData;
            }

            const gaussianInput = document.getElementById('gaussianSlider');
            const radialInput = document.getElementById('radialSlider');

            const radius = gaussianInput ? getNumericValue(gaussianInput.value, 0) : getNumericValue(configMatrix.blur && configMatrix.blur.gaussian, 0);
            const intensity = radialInput ? getNumericValue(radialInput.value, 0) : getNumericValue(configMatrix.blur && configMatrix.blur.radial, 0);

            if (radius > 0 && typeof BlurFilters !== 'undefined' && typeof BlurFilters.applyGaussian === 'function') {
                processedImgData = BlurFilters.applyGaussian(processedImgData, radius) || processedImgData;
            }

            if (intensity > 0 && typeof BlurFilters !== 'undefined' && typeof BlurFilters.applyRadialDepth === 'function') {
                processedImgData = BlurFilters.applyRadialDepth(processedImgData, intensity) || processedImgData;
            }

            if (globalBaseline.sharpen !== 0) {
                processedImgData = window.CanvasEditor._applySharpenKernel(processedImgData, globalBaseline.sharpen);
            }

            if (globalBaseline.clarity !== 0) {
                processedImgData = window.CanvasEditor._applyClarityKernel(processedImgData, globalBaseline.clarity);
            }

            if (processedImgData && processedImgData.data) {
                imgData = processedImgData;
            }

            procCtx.putImageData(imgData, 0, 0);

            if (globalBaseline.vignette !== 0) {
                procCtx.save();
                procCtx.globalCompositeOperation = 'source-over';

                const cx = procCanvas.width / 2;
                const cy = procCanvas.height / 2;
                const maxRadius = Math.sqrt(cx * cx + cy * cy);

                const gradient = procCtx.createRadialGradient(cx, cy, maxRadius * 0.2, cx, cy, maxRadius * 0.85);
                const opacity = Math.min(1, Math.abs(globalBaseline.vignette) / 100);

                if (globalBaseline.vignette > 0) {
                    gradient.addColorStop(0, 'rgba(0,0,0,0)');
                    gradient.addColorStop(1, `rgba(0,0,0,${opacity * 0.85})`);
                } else {
                    gradient.addColorStop(0, 'rgba(255,255,255,0)');
                    gradient.addColorStop(1, `rgba(255,255,255,${opacity * 0.85})`);
                }

                procCtx.fillStyle = gradient;
                procCtx.fillRect(0, 0, procCanvas.width, procCanvas.height);
                procCtx.restore();
            }

            targetCanvas.width = baseWidth;
            targetCanvas.height = baseHeight;

            const targetCtx = targetCanvas.getContext('2d');
            if (targetCtx) {
                targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
                targetCtx.imageSmoothingEnabled = true;
                targetCtx.imageSmoothingQuality = 'high';
                targetCtx.drawImage(procCanvas, 0, 0, baseWidth, baseHeight);
            }

            if (activeLayer) {
                activeLayer.canvas = targetCanvas;
                if (!activeLayer.sourceImage && sourceImg !== targetCanvas) {
                    activeLayer.sourceImage = sourceImg;
                }
            } else {
                window.imgState.imageXCanvas = targetCanvas;
            }

            window.CanvasEditor.renderCanvasStack();

            if (typeof window.CanvasEditor.redraw === 'function') {
                window.CanvasEditor.redraw();
            }
        } catch (error) {
            console.error('Pipeline processing failure:', error);
        } finally {
            window.canvasRenderPending = false;
        }
    });
},

    _applySharpenKernel: (imgData, value) => {
        const w = imgData.width;
        const h = imgData.height;
        const src = imgData.data;

        if (!w || !h || !src) return imgData;

        if (!window.CanvasEditor._kernelCanvasBuffer) {
            window.CanvasEditor._kernelCanvasBuffer = document.createElement('canvas');
        }

        const bufferCanvas = window.CanvasEditor._kernelCanvasBuffer;

        if (bufferCanvas.width !== w || bufferCanvas.height !== h) {
            bufferCanvas.width = w;
            bufferCanvas.height = h;
            window.CanvasEditor._kernelCtxBuffer = bufferCanvas.getContext('2d');
        }

        if (!window.CanvasEditor._kernelCtxBuffer) return imgData;

        const outImgData = window.CanvasEditor._kernelCtxBuffer.createImageData(w, h);
        const dst = outImgData.data;

        dst.set(src);

        const strength = (getNumericValue(value, 0) / 100) * 0.5;
        const kCenter = 1 + 4 * strength;
        const kEdge = -strength;

        for (let y = 1; y < h - 1; y++) {
            const rowOffset = y * w;
            const prevRowOffset = (y - 1) * w;
            const nextRowOffset = (y + 1) * w;

            for (let x = 1; x < w - 1; x++) {
                const idx = (rowOffset + x) * 4;
                const leftIdx = idx - 4;
                const rightIdx = idx + 4;
                const topIdx = (prevRowOffset + x) * 4;
                const bottomIdx = (nextRowOffset + x) * 4;

                const r = src[idx] * kCenter + (src[leftIdx] + src[rightIdx] + src[topIdx] + src[bottomIdx]) * kEdge;
                const g = src[idx + 1] * kCenter + (src[leftIdx + 1] + src[rightIdx + 1] + src[topIdx + 1] + src[bottomIdx + 1]) * kEdge;
                const b = src[idx + 2] * kCenter + (src[leftIdx + 2] + src[rightIdx + 2] + src[topIdx + 2] + src[bottomIdx + 2]) * kEdge;

                dst[idx] = Math.max(0, Math.min(255, r));
                dst[idx + 1] = Math.max(0, Math.min(255, g));
                dst[idx + 2] = Math.max(0, Math.min(255, b));
                dst[idx + 3] = src[idx + 3];
            }
        }

        return outImgData;
    },

_applyClarityKernel: (imgData, value) => {
    const w = imgData.width;
    const h = imgData.height;
    const src = imgData.data;

    if (!w || !h || !src) return imgData;

    if (!window.CanvasEditor._kernelCanvasBuffer) {
        window.CanvasEditor._kernelCanvasBuffer = document.createElement('canvas');
    }

    const bufferCanvas = window.CanvasEditor._kernelCanvasBuffer;

    if (bufferCanvas.width !== w || bufferCanvas.height !== h) {
        bufferCanvas.width = w;
        bufferCanvas.height = h;
        window.CanvasEditor._kernelCtxBuffer = bufferCanvas.getContext('2d');
    }

    if (!window.CanvasEditor._kernelCtxBuffer) return imgData;

    const outImgData = window.CanvasEditor._kernelCtxBuffer.createImageData(w, h);
    const dst = outImgData.data;

    dst.set(src);

    const strength = (getNumericValue(value, 0) / 100) * 0.35;
    const stride = window.CanvasEditor.isScrubbing ? 4 : 2;

    for (let y = 2; y < h - 2; y += stride) {
        const currentYOffset = y * w;

        for (let x = 2; x < w - 2; x += stride) {
            const idx = (currentYOffset + x) * 4;

            const centerLuma = 0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2];
            const leftLuma = 0.299 * src[idx - 8] + 0.587 * src[idx - 7] + 0.114 * src[idx - 6];
            const rightLuma = 0.299 * src[idx + 8] + 0.587 * src[idx + 9] + 0.114 * src[idx + 10];
            const localAvg = (centerLuma + leftLuma + rightLuma) / 3;

            for (let dy = 0; dy < stride; dy++) {
                const yy = y + dy;
                if (yy >= h) break;

                const blockYOffset = yy * w;

                for (let dx = 0; dx < stride; dx++) {
                    const xx = x + dx;
                    if (xx >= w) break;

                    const targetIdx = (blockYOffset + xx) * 4;

                    let r = src[targetIdx];
                    let g = src[targetIdx + 1];
                    let b = src[targetIdx + 2];

                    r = r + (r - localAvg) * strength;
                    g = g + (g - localAvg) * strength;
                    b = b + (b - localAvg) * strength;

                    dst[targetIdx] = Math.max(0, Math.min(255, r));
                    dst[targetIdx + 1] = Math.max(0, Math.min(255, g));
                    dst[targetIdx + 2] = Math.max(0, Math.min(255, b));
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

        if (!ctx) return;

        const state = window.imgState;

        if (!state.img && (!window.LayerManager || !Array.isArray(window.LayerManager.layers) || window.LayerManager.layers.length === 0)) {
            return;
        }

        const canvasArea = document.getElementById('canvas') || document.getElementById('canvasArea');

        const targetW = canvasArea ? (canvasArea.clientWidth || 800) : 800;
        const targetH = canvasArea ? (canvasArea.clientHeight || 600) : 600;

        if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const MAX_PREVIEW_DIM = 1024;
        const needsDownsample = state.width > MAX_PREVIEW_DIM || state.height > MAX_PREVIEW_DIM;

        ctx.imageSmoothingEnabled = !(window.CanvasEditor.isScrubbing && needsDownsample);
        ctx.imageSmoothingQuality = 'high';

        if (typeof window.initLayersEngine === 'function') {
            try {
                window.initLayersEngine();
            } catch (error) {
                console.warn('Layer engine initialization warning:', error);
            }
        }

        if (window.LayerManager && Array.isArray(window.LayerManager.layers) && window.LayerManager.layers.length > 0) {
            window.CanvasEditor.renderCanvasStack();
        } else if (state.imageXCanvas) {
            const source = state.imageXCanvas;

            if (source.width <= 0 || source.height <= 0) return;

            ctx.save();

            const x = getNumericValue(state.x, 0);
            const y = getNumericValue(state.y, 0);
            const width = getNumericValue(state.width, source.width);
            const height = getNumericValue(state.height, source.height);
            const rotation = getNumericValue(state.rotation, 0);

            const centerX = x + width / 2;
            const centerY = y + height / 2;

            ctx.translate(centerX, centerY);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.translate(-centerX, -centerY);

            ctx.drawImage(source, x, y, width, height);

            ctx.restore();
        }

        if (state.isSelected) {
            ctx.save();

            const centerX = state.x + state.width / 2;
            const centerY = state.y + state.height / 2;

            ctx.translate(centerX, centerY);
            ctx.rotate(((state.rotation || 0) * Math.PI) / 180);

            ctx.strokeStyle = '#00bcd4';
            ctx.lineWidth = 2;
            ctx.strokeRect(-state.width / 2, -state.height / 2, state.width, state.height);

            const hs = state.handleSize || 10;
            const halfW = state.width / 2;
            const halfH = state.height / 2;

            const handleCoords = [
                { x: -halfW - hs / 2, y: -halfH - hs / 2 },
                { x: halfW - hs / 2, y: -halfH - hs / 2 },
                { x: -halfW - hs / 2, y: halfH - hs / 2 },
                { x: halfW - hs / 2, y: halfH - hs / 2 }
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

    resetStateForCroppedImage: function (newWidth, newHeight) {
        const canvas = document.getElementById('editorCanvas');

        if (!canvas) return;

        const width = Math.max(1, Math.round(getNumericValue(newWidth, window.imgState.width || 1)));
        const height = Math.max(1, Math.round(getNumericValue(newHeight, window.imgState.height || 1)));

        window.imgState.width = width;
        window.imgState.height = height;
        window.imgState.rotation = 0;
        window.imgState.x = 0;
        window.imgState.y = 0;

        canvas.width = width;
        canvas.height = height;
    }
};

function resizeCanvasToFit() {
    const canvas = document.getElementById('editorCanvas');
    const canvasArea = document.getElementById('canvas') || document.getElementById('canvasArea');

    if (!canvas || !canvasArea) return;

    canvas.width = canvasArea.clientWidth || 800;
    canvas.height = canvasArea.clientHeight || 600;
}

function initializeImageFromBlob(fileBlob) {
    if (!fileBlob) {
        console.warn('Visuals: selectedImage was not found in IndexedDB.');
        return;
    }

    if (!(fileBlob instanceof Blob)) {
        console.error('Visuals: selectedImage is not a valid Blob.', fileBlob);
        return;
    }

    const objectURL = URL.createObjectURL(fileBlob);
    const img = new Image();

    img.onload = () => {
        try {
            window.imgState.img = img;

            const canvasArea = document.getElementById('canvas') || document.getElementById('canvasArea');

            const maxDisplayW = canvasArea ? (canvasArea.clientWidth || 800) : 800;
            const maxDisplayH = canvasArea ? (canvasArea.clientHeight || 600) : 600;

            const allowedW = Math.max(1, maxDisplayW * 0.9);
            const allowedH = Math.max(1, maxDisplayH * 0.9);

            let displayW = img.naturalWidth || img.width;
            let displayH = img.naturalHeight || img.height;

            if (displayW <= 0 || displayH <= 0) {
                console.error('Visuals: loaded image has invalid dimensions.');
                URL.revokeObjectURL(objectURL);
                return;
            }

            if (displayW > allowedW || displayH > allowedH) {
                const scaleX = allowedW / displayW;
                const scaleY = allowedH / displayH;
                const fitScale = Math.min(scaleX, scaleY);

                displayW = Math.max(1, Math.round(displayW * fitScale));
                displayH = Math.max(1, Math.round(displayH * fitScale));
            }

            window.imgState.x = Math.round((maxDisplayW - displayW) / 2);
            window.imgState.y = Math.round((maxDisplayH - displayH) / 2);
            window.imgState.width = displayW;
            window.imgState.height = displayH;
            window.imgState.rotation = 0;
            window.imgState.isSelected = true;

            const offscreen = document.createElement('canvas');

            offscreen.width = img.naturalWidth || img.width;
            offscreen.height = img.naturalHeight || img.height;

            const offscreenCtx = offscreen.getContext('2d');

            if (!offscreenCtx) {
                console.error('Visuals: unable to create image canvas context.');
                URL.revokeObjectURL(objectURL);
                return;
            }

            offscreenCtx.drawImage(img, 0, 0, offscreen.width, offscreen.height);

            window.imgState.imageXCanvas = offscreen;

            ensureSelectionAdjustmentState();

            const bgLayer = window.LayerManager && Array.isArray(window.LayerManager.layers) ? window.LayerManager.layers.find(l => l.id === 1 || l.id === 'bg') : null;

            if (bgLayer) {
                bgLayer.canvas = offscreen;
                bgLayer.sourceImage = img;
                bgLayer.originalCanvas = offscreen;
                bgLayer.width = displayW;
                bgLayer.height = displayH;
                bgLayer.x = window.imgState.x;
                bgLayer.y = window.imgState.y;
                bgLayer.rotation = 0;
            }

            if (window.CanvasEditor.resetStateForCroppedImage) {
                window.CanvasEditor.resetStateForCroppedImage(displayW, displayH);
            }

            if (window.HistoryManager && typeof window.HistoryManager.clearToDefaultStates === 'function') {
                window.HistoryManager.clearToDefaultStates();
                if (window.HistoryManager.historyStack && window.HistoryManager.historyStack[0]) {
                    window.HistoryManager.historyStack[0].state.transform.width = displayW;
                    window.HistoryManager.historyStack[0].state.transform.height = displayH;
                }
            }

            window.canvasRenderPending = false;

            window.dispatchEvent(new CustomEvent('editorHistoryChanged'));

            requestAnimationFrame(() => {
                window.CanvasEditor.redraw();
            });
        } catch (error) {
            console.error('Visuals: image initialization failed:', error);
        } finally {
            URL.revokeObjectURL(objectURL);
        }
    };

    img.onerror = error => {
        console.error('Visuals: failed to load selected image from IndexedDB.', error);
        URL.revokeObjectURL(objectURL);
    };

    img.src = objectURL;
}

function loadSelectedImageFromIndexedDB() {
    let dbRequest;

    try {
        dbRequest = indexedDB.open('VisualsDB', 1);
    } catch (error) {
        console.error('Visuals: unable to open IndexedDB:', error);
        return;
    }

    dbRequest.onerror = event => {
        console.error('Visuals: IndexedDB open failed:', event.target.error);
    };

    dbRequest.onupgradeneeded = event => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('images')) {
            try {
                db.createObjectStore('images');
            } catch (error) {
                console.warn('Visuals: unable to create images object store:', error);
            }
        }
    };

    dbRequest.onsuccess = event => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('images')) {
            console.warn('Visuals: images object store does not exist.');
            return;
        }

        let transaction;

        try {
            transaction = db.transaction(['images'], 'readonly');
        } catch (error) {
            console.error('Visuals: unable to create IndexedDB transaction:', error);
            return;
        }

        const store = transaction.objectStore('images');
        const getRequest = store.get('selectedImage');

        getRequest.onerror = event => {
            console.error('Visuals: unable to retrieve selectedImage:', event.target.error);
        };

        getRequest.onsuccess = () => {
            initializeImageFromBlob(getRequest.result);
        };
    };
}

document.addEventListener('DOMContentLoaded', () => {
    ensureSelectionAdjustmentState();

    resizeCanvasToFit();

    loadSelectedImageFromIndexedDB();

    window.addEventListener('editorHistoryChanged', () => {
        if (window.CanvasEditor && typeof window.CanvasEditor.applyEffectsPipeline === 'function') {
            window.CanvasEditor.applyEffectsPipeline();
        }
    });

    document.addEventListener('input', e => {
        if (e.target && (e.target.type === 'range' || e.target.id === 'transformWidthInput' || e.target.id === 'transformHeightInput')) {
            window.CanvasEditor.isScrubbing = true;
        }
    });

    let pipelineDebounceTimeout = null;

    document.addEventListener('change', e => {
        if (e.target && (e.target.type === 'range' || e.target.id === 'transformWidthInput' || e.target.id === 'transformHeightInput')) {
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

    window.addEventListener('resize', () => {
        resizeCanvasToFit();

        if (window.CanvasEditor && typeof window.CanvasEditor.redraw === 'function') {
            window.CanvasEditor.redraw();
        }
    });
});

    window.syncAdjustToolUI = function (isSelectionActive) {
        const state = ensureSelectionAdjustmentState();
        const activeGroup = isSelectionActive ? state.local : state.global;

        const scalarInputs = {
            exposureSlider: activeGroup.scalar.exposure,
            brightnessSlider: activeGroup.scalar.brightness,
            contrastSlider: activeGroup.scalar.contrast,
            saturationSlider: activeGroup.scalar.saturation,
            temperatureSlider: activeGroup.scalar.temperature,
            tintSlider: activeGroup.scalar.tint
        };

        Object.keys(scalarInputs).forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.value = scalarInputs[inputId];
            }
        });

        const baselineInputs = {
            highlightsSlider: activeGroup.baseline.highlights,
            shadowsSlider: activeGroup.baseline.shadows,
            vibranceSlider: activeGroup.baseline.vibrance
        };

        Object.keys(baselineInputs).forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.value = baselineInputs[inputId];
            }
        });

        window.CanvasEditor.applyEffectsPipeline();
    };

})();
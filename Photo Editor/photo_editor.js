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

    // FIX: Restores the original image state onto the canvas when the user clicks Discard/Back
    rollbackDirectCanvasChanges: function(cachedImageData) {
        if (!window.imgState.imageXCanvas || !cachedImageData) return;
        const ctx = window.imgState.imageXCanvas.getContext('2d');
        ctx.putImageData(cachedImageData, 0, 0);
        this.redraw();
    },


    /**
     * Central processing module processing all tools sequentially
     */
 applyEffectsPipeline: () => {
        // If a render frame is already scheduled or processing, skip this turn
        if (window.canvasRenderPending) return; 

        window.canvasRenderPending = true;
        
        requestAnimationFrame(() => {
            try {
                if (!window.imgState.img || !window.imgState.imageXCanvas) return;

                const originalImg = window.imgState.img;
                const targetCanvas = window.imgState.imageXCanvas;
                const ctx = targetCanvas.getContext('2d');

                // Clear and match original size coordinates cleanly
                ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
                ctx.drawImage(originalImg, 0, 0);

                let imgData = ctx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
                
                // Fetch the absolute state snapshot from timeline tracking memory
                let currentTrack = window.HistoryManager.getCurrentParameters();
                let scalar = currentTrack.scalar;
                let baseline = currentTrack.baseline;

                // --- HARDWARE DELEGATED MATRIX FILTERS (SVG / CSS Effects) ---
                let filterString = "";
                if (scalar.temperature !== 0 || scalar.tint !== 0) {
                    window.CanvasEditor._updateHardwareMatrixFilters(scalar.temperature, scalar.tint);
                    filterString += "url(#temperatureMatrixFilter) url(#tintMatrixFilter) ";
                }
                ctx.filter = filterString.trim() || "none";

                // --- CPU PER-PIXEL COMPUTATION KERNELS ---
                if (scalar.exposure !== 0.0) {
                    imgData = window.CanvasEditor._applyExposureKernel(imgData, scalar.exposure);
                }
                if (scalar.brightness !== 0) {
                    imgData = window.CanvasEditor._applyBrightnessKernel(imgData, scalar.brightness);
                }
                if (scalar.contrast !== 0) {
                    imgData = window.CanvasEditor._applyContrastKernel(imgData, scalar.contrast);
                }
                if (scalar.saturation !== 0) {
                    imgData = window.CanvasEditor._applySaturationKernel(imgData, scalar.saturation);
                }

                // Complex Kernel Combinations
                if (baseline.highlights !== 0 || baseline.shadows !== 0) {
                    imgData = window.CanvasEditor._applyHighlightsShadowsKernel(imgData, baseline.highlights, baseline.shadows);
                }
                if (baseline.vibrance !== 0) {
                    imgData = window.CanvasEditor._applyVibranceKernel(imgData, baseline.vibrance);
                }
                if (baseline.vignette !== 0) {
                    imgData = window.CanvasEditor._applyVignetteKernel(imgData, baseline.vignette);
                }
                if (baseline.sharpen !== 0) {
                    imgData = window.CanvasEditor._applySharpenKernel(imgData, baseline.sharpen);
                }
                if (baseline.clarity !== 0) {
                    imgData = window.CanvasEditor._applyClarityKernel(imgData, baseline.clarity);
                }

                // Render compiled image buffer back onto visual element frame context
                ctx.putImageData(imgData, 0, 0);
                window.CanvasEditor.redraw();
                
            } catch (error) {
                console.error("Pipeline processing failure:", error);
            } finally {
                // Safely open up the block for the next browser paint layout update
                window.canvasRenderPending = false;
            }
        });
    },
    /**
     * High-speed convolution pass used for image sharpening
     * @private
     */
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

    /**
     * Localized contrast enhancement routine executing image clarity adjustments
     * @private
     */
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

window.addEventListener('editorHistoryChanged', () => {
    window.CanvasEditor.applyEffectsPipeline();
});

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
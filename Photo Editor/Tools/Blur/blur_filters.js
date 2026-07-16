// Tools/Blur/blur_filters.js

const BlurFilters = {
    /**
     * Pure CPU Proportional Sliding-Window Box Blur
     * Optimized for high thread performance on mobile devices & Android WebView.
     */
    applyGaussian(srcImageData, radius) {
    if (radius === 0) return srcImageData;

    const w = srcImageData.width;
    const h = srcImageData.height;
    
    // Pass the radius clean into the box blur processor
    let optimizedRadius = radius; 
    if (Math.max(w, h) > 2500) {
        optimizedRadius = Math.min(radius, 30); // Generous ceiling for high-res screens
    }

    const firstPassBuffer = new Uint8ClampedArray(srcImageData.data.length);
    const secondPassBuffer = new Uint8ClampedArray(srcImageData.data.length);
    const srcPixels = srcImageData.data;

    this._boxBlurPass(srcPixels, firstPassBuffer, w, h, optimizedRadius, true);
    this._boxBlurPass(firstPassBuffer, secondPassBuffer, w, h, optimizedRadius, false); 
    
    return new ImageData(secondPassBuffer, w, h);
},
_boxBlurPass(src, dst, w, h, radius, isHorizontal) {
    const r = Math.min(radius, Math.floor((isHorizontal ? w : h) / 2) - 1);
    const div = r + r + 1;

    const outerMax = isHorizontal ? h : w;
    const innerMax = isHorizontal ? w : h;

    for (let outer = 0; outer < outerMax; outer++) {
        let rSum = 0, gSum = 0, bSum = 0, aSum = 0;

        const getIndex = (inlineCoord) => {
            const x = isHorizontal ? inlineCoord : outer;
            const y = isHorizontal ? outer : inlineCoord;
            return (y * w + x) * 4;
        };

        // 1. Initialize the window accumulator with proper edge replication
        const firstIdx = getIndex(0);
        const lastIdx = getIndex(innerMax - 1);

        // Safely extract fallback edge boundary components
        const fR = src[firstIdx] || 0, fG = src[firstIdx + 1] || 0, fB = src[firstIdx + 2] || 0, fA = src[firstIdx + 3] || 0;
        const lR = src[lastIdx] || 0,  lG = src[lastIdx + 1] || 0,  lB = src[lastIdx + 2] || 0,  lA = src[lastIdx + 3] || 0;

        // Pre-populate the accumulator matching the exact clamped window bounds
        for (let i = 0; i < div; i++) {
            const inlinePos = i - r;
            if (inlinePos < 0) {
                rSum += fR; gSum += fG; bSum += fB; aSum += fA;
            } else if (inlinePos >= innerMax) {
                rSum += lR; gSum += lG; bSum += lB; aSum += lA;
            } else {
                const idx = getIndex(inlinePos);
                rSum += src[idx] || 0; 
                gSum += src[idx + 1] || 0; 
                bSum += src[idx + 2] || 0; 
                aSum += src[idx + 3] || 0;
            }
        }

        // 2. Slide the window precisely across the pixel row/column
        for (let inner = 0; inner < innerMax; inner++) {
            const dstIdx = getIndex(inner);
            
            // Fast bitwise truncation to integers
            dst[dstIdx]     = (rSum / div) | 0; 
            dst[dstIdx + 1] = (gSum / div) | 0;
            dst[dstIdx + 2] = (bSum / div) | 0;
            dst[dstIdx + 3] = (aSum / div) | 0;

            const nextInner = inner + r + 1;
            const prevInner = inner - r;

            // FIXED: Added absolute pixel channel validation guards (|| 0) to prevent NaN drift
            if (nextInner >= innerMax) {
                rSum += lR; gSum += lG; bSum += lB; aSum += lA;
            } else {
                const nextIdx = getIndex(nextInner);
                rSum += src[nextIdx] || 0; 
                gSum += src[nextIdx + 1] || 0; 
                bSum += src[nextIdx + 2] || 0; 
                aSum += src[nextIdx + 3] || 0;
            }

            if (prevInner < 0) {
                rSum -= fR; gSum -= fG; bSum -= fB; aSum -= fA;
            } else {
                const prevIdx = getIndex(prevInner);
                rSum -= src[prevIdx] || 0; 
                gSum -= src[prevIdx + 1] || 0; 
                bSum -= src[prevIdx + 2] || 0; 
                aSum -= src[prevIdx + 3] || 0;
            }
        }
    }
},
    applyRadialDepth(srcImageData, intensity) {
        if (intensity === 0) return srcImageData;

        const w = srcImageData.width;
        const h = srcImageData.height;

        const calcCanvas = document.createElement('canvas');
        calcCanvas.width = w;
        calcCanvas.height = h;
        const calcCtx = calcCanvas.getContext('2d');
        
        const offscreen = document.createElement('canvas');
        offscreen.width = w;
        offscreen.height = h;
        offscreen.getContext('2d').putImageData(srcImageData, 0, 0);

        calcCtx.clearRect(0, 0, w, h);
        calcCtx.save();

        const steps = window.CanvasEditor && window.CanvasEditor.isScrubbing ? 4 : 8; 
        const factor = intensity / 1000; 
        const centerX = w / 2;
        const centerY = h / 2;

        calcCtx.globalAlpha = 1 / steps;
        for (let i = 0; i < steps; i++) {
            const scale = 1 + (i * factor);
            calcCtx.save();
            calcCtx.translate(centerX, centerY);
            calcCtx.scale(scale, scale);
            calcCtx.translate(-centerX, -centerY);
            calcCtx.drawImage(offscreen, 0, 0);
            calcCtx.restore();
        }
        calcCtx.restore();
        
        return calcCtx.getImageData(0, 0, w, h);
    }
};

window.BlurFilters = BlurFilters;

window.BlurManager = {
    isActive: false,
    gaussianSlider: null,
    radialSlider: null,
    init() {
        this.gaussianSlider = document.getElementById('gaussianSlider');
        this.radialSlider = document.getElementById('radialSlider');
        
        if (this.gaussianSlider || this.radialSlider) {
            this.isActive = true;
        }

        const syncBlurChange = (e) => {
            if (!e.target) return;
            const key = e.target.id === 'gaussianSlider' ? 'gaussian' : 'radial';
            if (window.HistoryManager) {
                window.HistoryManager.updateValue(key, e.target.value);
            }
        };

        if (this.gaussianSlider) {
            this.gaussianSlider.addEventListener('input', syncBlurChange);
        }
        if (this.radialSlider) {
            this.radialSlider.addEventListener('input', syncBlurChange);
        }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    window.BlurManager.init();
});
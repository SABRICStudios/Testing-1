// Tools/Blur/blur_filters.js

const BlurFilters = {
    /**
     * Pure CPU Proportional Sliding-Window Box Blur
     * Optimized for high thread performance on mobile devices & Android WebView.
     * Overloaded to handle both 2-argument and 3-argument pipeline calls safely.
     */
    applyGaussian(srcImageData, arg2, arg3) {
        let radius;
        let canvasBuffer = null;

        // Detect call signature: (srcImageData, canvasBuffer, radius) vs (srcImageData, radius)
        if (arg3 !== undefined) {
            canvasBuffer = arg2;
            radius = arg3;
        } else {
            radius = arg2;
        }

        if (radius === 0) return srcImageData;

        const w = srcImageData.width;
        const h = srcImageData.height;
        
        let optimizedRadius = radius; 
        if (Math.max(w, h) > 2500) {
            optimizedRadius = Math.min(radius, 30); // Generous ceiling for high-res screens
        }

        const firstPassBuffer = new Uint8ClampedArray(srcImageData.data.length);
        const secondPassBuffer = new Uint8ClampedArray(srcImageData.data.length);
        const srcPixels = srcImageData.data;

        this._boxBlurPass(srcPixels, firstPassBuffer, w, h, optimizedRadius, true);
        this._boxBlurPass(firstPassBuffer, secondPassBuffer, w, h, optimizedRadius, false); 
        
        const blurredData = new ImageData(secondPassBuffer, w, h);

        // If a canvas buffer was supplied, commit the pixels directly to it
        if (canvasBuffer && typeof canvasBuffer.getContext === 'function') {
            const ctx = canvasBuffer.getContext('2d');
            ctx.putImageData(blurredData, 0, 0);
        }
        
        return blurredData;
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

            const firstIdx = getIndex(0);
            const lastIdx = getIndex(innerMax - 1);

            const fR = src[firstIdx] || 0, fG = src[firstIdx + 1] || 0, fB = src[firstIdx + 2] || 0, fA = src[firstIdx + 3] || 0;
            const lR = src[lastIdx] || 0,  lG = src[lastIdx + 1] || 0,  lB = src[lastIdx + 2] || 0,  lA = src[lastIdx + 3] || 0;

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

            for (let inner = 0; inner < innerMax; inner++) {
                const dstIdx = getIndex(inner);
                
                dst[dstIdx]     = (rSum / div) | 0; 
                dst[dstIdx + 1] = (gSum / div) | 0;
                dst[dstIdx + 2] = (bSum / div) | 0;
                dst[dstIdx + 3] = (aSum / div) | 0;

                const nextInner = inner + r + 1;
                const prevInner = inner - r;

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

    applyRadialDepth(srcImageData, arg2, arg3) {
        let intensity;
        let canvasBuffer = null;

        // Detect call signature: (srcImageData, canvasBuffer, intensity) vs (srcImageData, intensity)
        if (arg3 !== undefined) {
            canvasBuffer = arg2;
            intensity = arg3;
        } else {
            intensity = arg2;
        }

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
        
        const finalData = calcCtx.getImageData(0, 0, w, h);
        
        // If a canvas buffer was supplied, commit the pixels directly to it
        if (canvasBuffer && typeof canvasBuffer.getContext === 'function') {
            const bufCtx = canvasBuffer.getContext('2d');
            bufCtx.putImageData(finalData, 0, 0);
        }

        return finalData;
    }
};

window.BlurFilters = BlurFilters;
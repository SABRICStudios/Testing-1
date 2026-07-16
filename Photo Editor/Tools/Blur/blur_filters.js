// Tools/Blur/blur_filters.js

const BlurFilters = {
    // Keep a lightweight offscreen scratchpad cached to avoid GC spikes
    _proxyCanvas: null,
    _proxyCtx: null,
    _fullCanvas: null,
    _fullCtx: null,

    applyGaussian(srcImageData, arg2, arg3) {
        let radius;
        let canvasBuffer = null;

        if (arg3 !== undefined) {
            canvasBuffer = arg2;
            radius = arg3;
        } else {
            radius = arg2;
        }

        if (radius === 0) return srcImageData;

        const w = srcImageData.width;
        const h = srcImageData.height;
        const isScrubbing = window.CanvasEditor && window.CanvasEditor.isScrubbing;

        // -------------------------------------------------------------
        // OPTIMIZATION: DOWNSAMPLE & UPSCALE DURING ACTIVE SCRUBBING
        // -------------------------------------------------------------
        if (isScrubbing && (w > 300 || h > 300)) {
            // 1. Calculate a tiny proxy size (e.g., max 200px)
            const proxyMax = 200;
            const scale = proxyMax / Math.max(w, h);
            const pw = Math.round(w * scale);
            const ph = Math.round(h * scale);
            const scaledRadius = Math.max(1, Math.round(radius * scale));

            // 2. Initialize or resize our cached scratchpad canvases
            if (!this._proxyCanvas) {
                this._proxyCanvas = document.createElement('canvas');
                this._proxyCtx = this._proxyCanvas.getContext('2d', { willReadFrequently: true });
                this._fullCanvas = document.createElement('canvas');
                this._fullCtx = this._fullCanvas.getContext('2d');
            }
            
            this._proxyCanvas.width = pw;
            this._proxyCanvas.height = ph;
            this._fullCanvas.width = w;
            this._fullCanvas.height = h;

            // 3. Draw full imageData onto full canvas, then scale down onto proxy canvas
            const tempImgData = new ImageData(new Uint8ClampedArray(srcImageData.data), w, h);
            this._fullCtx.putImageData(tempImgData, 0, 0);
            
            this._proxyCtx.clearRect(0, 0, pw, ph);
            this._proxyCtx.drawImage(this._fullCanvas, 0, 0, pw, ph);

            // 4. Extract and blur the tiny image (CPU math is incredibly fast on 200px!)
            const proxyData = this._proxyCtx.getImageData(0, 0, pw, ph);
            const firstPass = new Uint8ClampedArray(proxyData.data.length);
            const secondPass = new Uint8ClampedArray(proxyData.data.length);
            
            this._boxBlurPass(proxyData.data, firstPass, pw, ph, scaledRadius, true);
            this._boxBlurPass(firstPass, secondPass, pw, ph, scaledRadius, false);

            const blurredProxyData = new ImageData(secondPass, pw, ph);
            this._proxyCtx.putImageData(blurredProxyData, 0, 0);

            // 5. Stretch the blurred tiny image back to full size on the destination canvas
            if (canvasBuffer && typeof canvasBuffer.getContext === 'function') {
                const ctx = canvasBuffer.getContext('2d');
                ctx.clearRect(0, 0, w, h);
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'medium'; // Smooths out pixelation artifacts
                ctx.drawImage(this._proxyCanvas, 0, 0, w, h);
                
                // Return high-res canvas image data so the rest of the chain has correct dimensions
                return ctx.getImageData(0, 0, w, h);
            }
        }

        // -------------------------------------------------------------
        // STANDARD PATH: Runs only once when touch ends / confirms
        // -------------------------------------------------------------
        let optimizedRadius = radius; 
        if (Math.max(w, h) > 2500) {
            optimizedRadius = Math.min(radius, 30);
        }

        const firstPassBuffer = new Uint8ClampedArray(srcImageData.data.length);
        const secondPassBuffer = new Uint8ClampedArray(srcImageData.data.length);
        const srcPixels = srcImageData.data;

        this._boxBlurPass(srcPixels, firstPassBuffer, w, h, optimizedRadius, true);
        this._boxBlurPass(firstPassBuffer, secondPassBuffer, w, h, optimizedRadius, false); 
        
        const blurredData = new ImageData(secondPassBuffer, w, h);

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
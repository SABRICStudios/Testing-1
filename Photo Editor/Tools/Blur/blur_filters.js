// Tools/Blur/blur_filters.js

const BlurFilters = {
    _proxyCanvas: null,
    _proxyCtx: null,

    applyGaussian(srcImageData, arg2, arg3) {
        let radius;
        let canvasBuffer = null;

        if (arg3 !== undefined) {
            canvasBuffer = arg2;
            radius = arg3;
        } else {
            radius = arg2;
        }

        if (!srcImageData || radius <= 0) return srcImageData;

        const w = srcImageData.width;
        const h = srcImageData.height;
        if (w === 0 || h === 0) return srcImageData;

        // Create a copy of srcImageData to prevent mutating original in place unpredictably
        const outputImageData = new ImageData(new Uint8ClampedArray(srcImageData.data), w, h);

        const firstPassBuffer = new Uint8ClampedArray(outputImageData.data.length);
        const secondPassBuffer = new Uint8ClampedArray(outputImageData.data.length);

        let safeRadius = Math.min(Math.round(radius), 100);

        // Perform 2-pass box blur approximation of Gaussian Blur
        this._boxBlurPass(outputImageData.data, firstPassBuffer, w, h, safeRadius, true);
        this._boxBlurPass(firstPassBuffer, secondPassBuffer, w, h, safeRadius, false);

        outputImageData.data.set(secondPassBuffer);

        if (canvasBuffer && typeof canvasBuffer.getContext === 'function') {
            const ctx = canvasBuffer.getContext('2d');
            ctx.putImageData(outputImageData, 0, 0);
        }

        return outputImageData;
    },

    _boxBlurPass(src, dst, w, h, radius, isHorizontal) {
        const innerMax = isHorizontal ? w : h;
        const outerMax = isHorizontal ? h : w;
        if (innerMax === 0 || outerMax === 0) return;

        const r = Math.min(radius, Math.floor(innerMax / 2) - 1);
        if (r <= 0) {
            dst.set(src);
            return;
        }
        const div = r + r + 1;

        for (let outer = 0; outer < outerMax; outer++) {
            let rSum = 0, gSum = 0, bSum = 0, aSum = 0;

            const getIndex = (inlineCoord) => {
                const x = isHorizontal ? inlineCoord : outer;
                const y = isHorizontal ? outer : inlineCoord;
                return (y * w + x) * 4;
            };

            const firstIdx = getIndex(0);
            const lastIdx = getIndex(innerMax - 1);

            const fR = src[firstIdx],     fG = src[firstIdx + 1], fB = src[firstIdx + 2], fA = src[firstIdx + 3];
            const lR = src[lastIdx],      lG = src[lastIdx + 1],  lB = src[lastIdx + 2],  lA = src[lastIdx + 3];

            // Initialize window sum
            for (let i = 0; i < div; i++) {
                const inlinePos = i - r;
                if (inlinePos < 0) {
                    rSum += fR; gSum += fG; bSum += fB; aSum += fA;
                } else if (inlinePos >= innerMax) {
                    rSum += lR; gSum += lG; bSum += lB; aSum += lA;
                } else {
                    const idx = getIndex(inlinePos);
                    rSum += src[idx]; gSum += src[idx + 1]; bSum += src[idx + 2]; aSum += src[idx + 3];
                }
            }

            // Slide window across inner dimension
            for (let inner = 0; inner < innerMax; inner++) {
                const dstIdx = getIndex(inner);

                dst[dstIdx]     = Math.min(255, Math.max(0, Math.round(rSum / div)));
                dst[dstIdx + 1] = Math.min(255, Math.max(0, Math.round(gSum / div)));
                dst[dstIdx + 2] = Math.min(255, Math.max(0, Math.round(bSum / div)));
                dst[dstIdx + 3] = Math.min(255, Math.max(0, Math.round(aSum / div)));

                const nextInner = inner + r + 1;
                const prevInner = inner - r;

                if (nextInner >= innerMax) {
                    rSum += lR; gSum += lG; bSum += lB; aSum += lA;
                } else {
                    const nextIdx = getIndex(nextInner);
                    rSum += src[nextIdx]; gSum += src[nextIdx + 1]; bSum += src[nextIdx + 2]; aSum += src[nextIdx + 3];
                }

                if (prevInner < 0) {
                    rSum -= fR; gSum -= fG; bSum -= fB; aSum -= fA;
                } else {
                    const prevIdx = getIndex(prevInner);
                    rSum -= src[prevIdx]; gSum -= src[prevIdx + 1]; bSum -= src[prevIdx + 2]; aSum -= src[prevIdx + 3];
                }
            }
        }
    },

    applyRadialDepth(srcImageData, arg2, arg3) {
        let intensity;
        let canvasBuffer = null;

        if (arg3 !== undefined) {
            canvasBuffer = arg2;
            intensity = arg3;
        } else {
            intensity = arg2;
        }

        if (!srcImageData || intensity <= 0) return srcImageData;

        const w = srcImageData.width;
        const h = srcImageData.height;
        if (w === 0 || h === 0) return srcImageData;

        const calcCanvas = document.createElement('canvas');
        calcCanvas.width = w;
        calcCanvas.height = h;
        const calcCtx = calcCanvas.getContext('2d');

        const offscreen = document.createElement('canvas');
        offscreen.width = w;
        offscreen.height = h;
        offscreen.getContext('2d').putImageData(srcImageData, 0, 0);

        calcCtx.clearRect(0, 0, w, h);

        // Draw baseline image first at 100% opacity so alpha/transparency is preserved
        calcCtx.drawImage(offscreen, 0, 0);

        const steps = window.CanvasEditor && window.CanvasEditor.isScrubbing ? 5 : 10;
        const maxFactor = (intensity / 100) * 0.15; // Max 15% radial zoom step
        const centerX = w / 2;
        const centerY = h / 2;

        // Overlay scaled iterations gradually over the opaque base image
        calcCtx.globalAlpha = 0.25;
        for (let i = 1; i <= steps; i++) {
            const scale = 1 + ((i / steps) * maxFactor);
            calcCtx.save();
            calcCtx.translate(centerX, centerY);
            calcCtx.scale(scale, scale);
            calcCtx.translate(-centerX, -centerY);
            calcCtx.drawImage(offscreen, 0, 0);
            calcCtx.restore();
        }

        calcCtx.globalAlpha = 1.0;
        const finalData = calcCtx.getImageData(0, 0, w, h);

        if (canvasBuffer && typeof canvasBuffer.getContext === 'function') {
            const bufCtx = canvasBuffer.getContext('2d');
            bufCtx.putImageData(finalData, 0, 0);
        }

        return finalData;
    }
};

window.BlurFilters = BlurFilters;
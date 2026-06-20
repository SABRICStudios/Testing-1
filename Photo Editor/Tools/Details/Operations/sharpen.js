/**
 * Tools/Details/OPERATIONS/sharpen.js
 * Lightroom-Grade Gaussian Unsharp Masking Engine
 */

window.DetailsSharpen = {
    apply(imgData, settings, edgeMaskArray) {
        const width = imgData.width;
        const height = imgData.height;
        const src = imgData.data;
        
        const output = new ImageData(new Uint8ClampedArray(src), width, height);
        const dst = output.data;

        const amount = settings.sharpenAmount / 100; 
        const radius = settings.sharpenRadius;
        const threshold = settings.sharpenThreshold;

        // Step A: Create a smooth Gaussian blurred buffer instead of a blocky box blur
        const blurredData = new Uint8ClampedArray(width * height * 4);
        this.gaussianBlur(src, blurredData, width, height, radius);

        // Step B: Calculate differential frequencies
        for (let i = 0; i < src.length; i += 4) {
            for (let c = 0; c < 3; c++) {
                const origVal = src[i + c];
                const blurVal = blurredData[i + c];
                const diff = origVal - blurVal;

                // Threshold gate to eliminate flat noise amplification
                if (Math.abs(diff) < threshold) continue;

                let sharpenEffect = diff * amount;

                // Restrict using our edge isolation map
                if (edgeMaskArray) {
                    const pixelIndex = i / 4;
                    const maskWeight = edgeMaskArray[pixelIndex] / 255;
                    sharpenEffect *= maskWeight;
                }

                const finalColor = origVal + sharpenEffect;
                dst[i + c] = Math.max(0, Math.min(255, finalColor));
            }
        }
        return output;
    },

    // Dual-pass separable Gaussian blur formula
    gaussianBlur(src, dst, w, h, radius) {
        const sigma = radius;
        const kernelSize = Math.max(3, Math.ceil(sigma * 3) * 2 + 1);
        const halfKernel = Math.floor(kernelSize / 2);
        
        // Generate Gaussian distribution curve coefficients
        const kernel = new Float32Array(kernelSize);
        let sum = 0;
        for (let i = -halfKernel; i <= halfKernel; i++) {
            const g = Math.exp(-(i * i) / (2 * sigma * sigma));
            kernel[i + halfKernel] = g;
            sum += g;
        }
        for (let i = 0; i < kernelSize; i++) {
            kernel[i] /= sum;
        }

        const temp = new Float32Array(w * h * 4);

        // Pass 1: Horizontal Blur
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let r = 0, g = 0, b = 0, a = 0;
                for (let k = -halfKernel; k <= halfKernel; k++) {
                    const nx = Math.min(w - 1, Math.max(0, x + k));
                    const idx = (y * w + nx) * 4;
                    const weight = kernel[k + halfKernel];
                    r += src[idx] * weight;
                    g += src[idx + 1] * weight;
                    b += src[idx + 2] * weight;
                    a += src[idx + 3] * weight;
                }
                const outIdx = (y * w + x) * 4;
                temp[outIdx] = r;
                temp[outIdx + 1] = g;
                temp[outIdx + 2] = b;
                temp[outIdx + 3] = a;
            }
        }

        // Pass 2: Vertical Blur
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let r = 0, g = 0, b = 0, a = 0;
                for (let k = -halfKernel; k <= halfKernel; k++) {
                    const ny = Math.min(h - 1, Math.max(0, y + k));
                    const idx = (ny * w + x) * 4;
                    const weight = kernel[k + halfKernel];
                    r += temp[idx] * weight;
                    g += temp[idx + 1] * weight;
                    b += temp[idx + 2] * weight;
                    a += temp[idx + 3] * weight;
                }
                const outIdx = (y * w + x) * 4;
                dst[outIdx] = r;
                dst[outIdx + 1] = g;
                dst[outIdx + 2] = b;
                dst[outIdx + 3] = a;
            }
        }
    }
};
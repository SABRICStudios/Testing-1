/**
 * Tools/Details/OPERATIONS/noise_reduction.js
 * High-Performance CPU Bilateral Filter for Luminance Denoising (Edge-Preserving)
 */

window.DetailsLumaDenoise = {
    apply(imgData, noiseLuminance, noiseLumDetail) { // Match incoming parameters
        const width = imgData.width;
        const height = imgData.height;
        const src = imgData.data;
        const output = new ImageData(new Uint8ClampedArray(src), width, height);
        const dst = output.data;

        // Map parameter names to what the pipeline passes
        const strength = noiseLuminance / 100;
        const radius = 2; 
        
        const spatialSigma = 2.0;
        const rangeSigma = 10.0 + (noiseLumDetail / 100) * 40.0;

        // --- PERFORMANCE OPTIMIZATION: Precompute Range Exp Lookup Table ---
        const expTable = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            expTable[i] = Math.exp(-(i * i) / (2 * rangeSigma * rangeSigma));
        }

        // --- PERFORMANCE OPTIMIZATION: Precompute Spatial Weights ---
        const spatialWeights = new Float32Array((radius * 2 + 1) * (radius * 2 + 1));
        for (let ky = -radius; ky <= radius; ky++) {
            for (let kx = -radius; kx <= radius; kx++) {
                const sIdx = (ky + radius) * (radius * 2 + 1) + (kx + radius);
                spatialWeights[sIdx] = Math.exp(-(kx * kx + ky * ky) / (2 * spatialSigma * spatialSigma));
            }
        }

        // Main Image Matrix processing loop
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                
                let rSum = 0, gSum = 0, bSum = 0, wSum = 0;
                const rCur = src[idx];
                const gCur = src[idx + 1];
                const bCur = src[idx + 2];

                // Preserve alpha channel completely
                dst[idx + 3] = src[idx + 3];

                for (let ky = -radius; ky <= radius; ky++) {
                    const ny = Math.min(height - 1, Math.max(0, y + ky));
                    const yStride = ny * width;

                    for (let kx = -radius; kx <= radius; kx++) {
                        const nx = Math.min(width - 1, Math.max(0, x + kx));
                        const nIdx = (yStride + nx) * 4;

                        const rN = src[nIdx];
                        const gN = src[nIdx + 1];
                        const bN = src[nIdx + 2];

                        // Fast absolute average value for structural intensity delta calculation
                        const diff = Math.abs(((rCur + gCur + bCur) - (rN + gN + bN)) / 3);
                        
                        // Fetch precomputed weights
                        const rWeight = expTable[Math.min(255, Math.floor(diff))];
                        const sIdx = (ky + radius) * (radius * 2 + 1) + (kx + radius);
                        const sWeight = spatialWeights[sIdx];
                        
                        const weight = sWeight * rWeight;

                        rSum += rN * weight;
                        gSum += gN * weight;
                        bSum += bN * weight;
                        wSum += weight;
                    }
                }

                // Smoothly blend filtered noise reduction back based on slider strength
                if (wSum > 0) {
                    dst[idx]     = rCur + ((rSum / wSum) - rCur) * strength;
                    dst[idx + 1] = gCur + ((gSum / wSum) - gCur) * strength;
                    dst[idx + 2] = bCur + ((bSum / wSum) - bCur) * strength;
                }
            }
        }

        return output;
    }
};
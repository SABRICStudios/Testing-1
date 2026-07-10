

window.DetailsColorDenoise = {
    apply(imgData, noiseColor, noiseColorDetail) { 
        const width = imgData.width;
        const height = imgData.height;
        const src = imgData.data;
        const output = new ImageData(new Uint8ClampedArray(src), width, height);
        const dst = output.data;

        const strength = noiseColor / 100;
        
        // Dynamic radius: Lower detail values mean larger radius (sweeps away big color blotches)
        // High detail values keep a small radius to protect edge color separation.
        const detail = noiseColorDetail !== undefined ? noiseColorDetail : 50;
        const radius = Math.max(1, Math.min(6, Math.floor((100 - detail) / 15) + 2));

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;

                const rCur = src[idx];
                const gCur = src[idx + 1];
                const bCur = src[idx + 2];

                // Convert target pixel to Chroma coordinates (Cb, Cr)
                const cbCur = -0.168736 * rCur - 0.331264 * gCur + 0.5 * bCur + 128;
                const crCur = 0.5 * rCur - 0.418688 * gCur - 0.081312 * bCur + 128;

                let cbSum = 0, crSum = 0, count = 0;

                // Gather neighborhood chroma channels
                for (let ky = -radius; ky <= radius; ky++) {
                    const ny = Math.min(height - 1, Math.max(0, y + ky));
                    const yStride = ny * width;

                    for (let kx = -radius; kx <= radius; kx++) {
                        const nx = Math.min(width - 1, Math.max(0, x + kx));
                        const nIdx = (yStride + nx) * 4;

                        const rN = src[nIdx];
                        const gN = src[nIdx + 1];
                        const bN = src[nIdx + 2];

                        cbSum += -0.168736 * rN - 0.331264 * gN + 0.5 * bN + 128;
                        crSum += 0.5 * rN - 0.418688 * gN - 0.081312 * bN + 128;
                        count++;
                    }
                }

                // Compute smoothed chroma averages
              // --- COMPUTE SMOOTHED CHROMA AVERAGES ---
                const cbTarget = cbSum / count;
                const crTarget = crSum / count;

                // --- SHADOW-AWARE CONTRAST PRESERVATION ADJUSTMENT ---
                // Calculate original luminance to determine shadow depth
                const yLuma = 0.299 * rCur + 0.587 * gCur + 0.114 * bCur;
                
                // Create a fade factor (0.0 to 1.0) that drops to 0 in deep shadows (under 45 brightness)
                const shadowWeight = Math.min(1.0, Math.max(0.0, (yLuma - 15) / 30));

                // Standard slider interpolation
                let cbFinal = cbCur + (cbTarget - cbCur) * strength;
                let crFinal = crCur + (crTarget - crCur) * strength;

                // If in deep shadows, gently pull chroma straight to neutral 128 
                // This eliminates stubborn color bleeding while restoring rich black levels
                if (shadowWeight < 1.0) {
                    cbFinal = 128 + (cbFinal - 128) * shadowWeight;
                    crFinal = 128 + (crFinal - 128) * shadowWeight;
                    
                    // Slightly depress luminance in shadows to restore depth lost to blur dispersion
                    // yLuma = yLuma * (0.9 + shadowWeight * 0.1);
                }

                // --- INVERSE MATRIX MAPPING: CONVERT BACK TO RGB ---
                let rOut = yLuma + 1.402 * (crFinal - 128);
                let gOut = yLuma - 0.344136 * (cbFinal - 128) - 0.714136 * (crFinal - 128);
                let bOut = yLuma + 1.772 * (cbFinal - 128);
            }
        }

        return output;
    }
};
/**
 * Tools/Details/OPERATIONS/noise_reduction.js
 * Multi-Pass Edge-Preserved Smart Denoise Engine for "Visuals"
 */

window.DetailsLumaDenoise = {
    apply(imgData, lumaAmount, lumaDetail) {
        const width = imgData.width;
        const height = imgData.height;
        const src = imgData.data;
        
        // Create an intermediate buffer to hold processing stages
        let workingData = new ImageData(new Uint8ClampedArray(src), width, height);
        
        const strength = lumaAmount / 100;
        // Low detail = high edge threshold (blurs larger artifacts); High detail = tight threshold
        const edgeThreshold = (101 - lumaDetail) * 0.6; 

        // Scale loop iterations dynamically based on strength to handle heavy grain
        const passes = lumaAmount > 70 ? 3 : (lumaAmount > 30 ? 2 : 1);

        // Run sequential smart-blending passes to mimic a massive processing radius safely
        for (let p = 0; p < passes; p++) {
            workingData = this._executeSmartBlurPass(workingData, edgeThreshold, strength);
        }

        return workingData;
    },

    /**
     * Executes a single horizontal & vertical edge-aware filtering sweep
     */
    _executeSmartBlurPass(imgData, threshold, strength) {
        const width = imgData.width;
        const height = imgData.height;
        const src = imgData.data;
        const output = new ImageData(new Uint8ClampedArray(src), width, height);
        const dst = output.data;

        // Pass 1: Horizontal Smart Sweep
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                
                let rSum = src[idx], gSum = src[idx + 1], bSum = src[idx + 2];
                let totalWeight = 1.0;

                const cLuma = (rSum + gSum + bSum) / 3;

                // Sample immediate left and right neighbors
                const sidePixels = [-2, -1, 1, 2];
                for (let k = 0; k < sidePixels.length; k++) {
                    const nx = x + sidePixels[k];
                    if (nx >= 0 && nx < width) {
                        const nIdx = (y * width + nx) * 4;
                        const nR = src[nIdx];
                        const nG = src[nIdx + 1];
                        const nB = src[nIdx + 2];
                        const nLuma = (nR + nG + nB) / 3;

                        // Check if the neighbor is an edge or just a grain speckle
                        if (Math.abs(cLuma - nLuma) < threshold) {
                            rSum += nR;
                            gSum += nG;
                            bSum += nB;
                            totalWeight += 1.0;
                        }
                    }
                }

                const pixelIndex = (y * width + x) * 4;
                dst[pixelIndex]     = src[pixelIndex] * (1 - strength) + (rSum / totalWeight) * strength;
                dst[pixelIndex + 1] = src[pixelIndex + 1] * (1 - strength) + (gSum / totalWeight) * strength;
                dst[pixelIndex + 2] = src[pixelIndex + 2] * (1 - strength) + (bSum / totalWeight) * strength;
            }
        }

        // Clone current progress to feed into the vertical sweep
        const intermediate = new Uint8ClampedArray(dst);

        // Pass 2: Vertical Smart Sweep
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                
                let rSum = intermediate[idx], gSum = intermediate[idx + 1], bSum = intermediate[idx + 2];
                let totalWeight = 1.0;

                const cLuma = (rSum + gSum + bSum) / 3;

                // Sample immediate top and bottom neighbors
                const verticalPixels = [-2, -1, 1, 2];
                for (let k = 0; k < verticalPixels.length; k++) {
                    const ny = y + verticalPixels[k];
                    if (ny >= 0 && ny < height) {
                        const nIdx = (ny * width + x) * 4;
                        const nR = intermediate[nIdx];
                        const nG = intermediate[nIdx + 1];
                        const nB = intermediate[nIdx + 2];
                        const nLuma = (nR + nG + nB) / 3;

                        if (Math.abs(cLuma - nLuma) < threshold) {
                            rSum += nR;
                            gSum += nG;
                            bSum += nB;
                            totalWeight += 1.0;
                        }
                    }
                }

                dst[idx]     = intermediate[idx] * (1 - strength) + (rSum / totalWeight) * strength;
                dst[idx + 1] = intermediate[idx + 1] * (1 - strength) + (gSum / totalWeight) * strength;
                dst[idx + 2] = intermediate[idx + 2] * (1 - strength) + (bSum / totalWeight) * strength;
            }
        }

        return output;
    }
};
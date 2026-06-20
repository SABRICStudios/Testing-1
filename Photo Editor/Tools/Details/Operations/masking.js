/**
 * Tools/Details/OPERATIONS/masking.js
 * Anti-Aliased Edge Isolation Mask Generator
 */

window.DetailsMasking = {
    generate(imgData, maskingValue) {
        const width = imgData.width;
        const height = imgData.height;
        const src = imgData.data;
        const mask = new Uint8ClampedArray(width * height);
        
        // Map slider values to match Lightroom curve threshold configurations
        const baseCutoff = (maskingValue / 100) * 80;

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                
                // Read luminance distribution
                const c = (src[idx] + src[idx + 1] + src[idx + 2]) / 3;
                const r = (src[idx + 4] + src[idx + 5] + src[idx + 6]) / 3;
                const b = (src[(y + 1) * width + x * 4] + src[(y + 1) * width + x * 4 + 1] + src[(y + 1) * width + x * 4 + 2]) / 3;

                // Fast spatial gradient approximation
                const dx = Math.abs(c - r);
                const dy = Math.abs(c - b);
                const magnitude = dx + dy;

                if (magnitude < baseCutoff) {
                    mask[y * width + x] = 0;
                } else {
                    // Smooth-step interpolation to completely eliminate jagged lines
                    const factor = (magnitude - baseCutoff) / (100 - baseCutoff + 0.001);
                    mask[y * width + x] = Math.min(255, factor * 255 * 1.5);
                }
            }
        }
        return mask;
    }
};
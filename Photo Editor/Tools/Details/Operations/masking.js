/**
 * Tools/Details/OPERATIONS/masking.js
 * Anti-Aliased Edge Isolation Mask Generator
 */

window.DetailsMasking = {
    generate(imgData, maskingValue) {
        const width = imgData.width;
        const height = imgData.height;
        const src = imgData.data;
        
        // Uint8 array is perfect and cheap on the CPU stack memory
        const mask = new Uint8ClampedArray(width * height);
        
        // Map slider values smoothly to contrast cutoff gates
        const baseCutoff = (maskingValue / 100) * 120;

        for (let y = 0; y < height - 1; y++) {
            for (let x = 0; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                const rightIdx = idx + 4;
                const downIdx = ((y + 1) * width + x) * 4;
                
                // Quick grayscale brightness calculation
                const currentLuma = (src[idx] + src[idx + 1] + src[idx + 2]) / 3;
                const rightLuma   = (src[rightIdx] + src[rightIdx + 1] + src[rightIdx + 2]) / 3;
                const downLuma    = (src[downIdx] + src[downIdx + 1] + src[downIdx + 2]) / 3;

                // Fast spatial gradient approximation (Manhattan distance calculation)
                const dx = Math.abs(currentLuma - rightLuma);
                const dy = Math.abs(currentLuma - downLuma);
                const magnitude = dx + dy;

                // If contrast variation is lower than slider threshold, drop it out (mask = 0)
                mask[y * width + x] = magnitude < baseCutoff ? 0 : 1;
            }
        }

        return mask;
    }
};
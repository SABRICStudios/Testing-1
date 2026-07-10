/**
 * Tools/Details/OPERATIONS/sharpen.js
 * High-Performance Smooth CPU Unsharp Masking Engine
 */

window.DetailsSharpen = {
    apply(imgData, settings, edgeMaskArray) {
        const width = imgData.width;
        const height = imgData.height;
        const src = imgData.data;
        
        const output = new ImageData(new Uint8ClampedArray(src), width, height);
        const dst = output.data;

        const amount = settings.sharpenAmount / 100; 
        const radius = Math.max(1, Math.round(settings.sharpenRadius)); // Clamp radius for fast integer strides
        const threshold = settings.sharpenThreshold;

        // Step A: Allocate a fast blurred buffer matrix
        const blurredData = new Uint8ClampedArray(src.length);
        this.fastBlur(src, blurredData, width, height, radius);

        // Step B: Calculate differential high frequencies and apply sharpening
        for (let i = 0; i < src.length; i += 4) {
            // Alpha channel bypasses modification
            dst[i + 3] = src[i + 3];

            // Check edge mask if it's currently generated and active
            if (edgeMaskArray && edgeMaskArray[i / 4] === 0) {
                dst[i]     = src[i];
                dst[i + 1] = src[i + 1];
                dst[i + 2] = src[i + 2];
                continue;
            }

            for (let c = 0; c < 3; c++) {
                const origVal = src[i + c];
                const blurVal = blurredData[i + c];
                const diff = origVal - blurVal;

                // Threshold gate to eliminate flat noise amplification
                if (Math.abs(diff) < threshold) {
                    dst[i + c] = origVal;
                    continue;
                }

                // Apply sharp boost adjustment
                let sharpened = origVal + diff * amount;
                
                // Keep values clamped within safe 8-bit RGB limits
                dst[i + c] = sharpened > 255 ? 255 : (sharpened < 0 ? 0 : sharpened);
            }
        }

        return output;
    },

    /**
     * Highly optimized CPU Box Blur approximation pass
     */
    fastBlur(src, dst, w, h, radius) {
        // Simple linear copy to begin
        dst.set(src);
        
        // Accumulator buffers for moving window
        const temp = new Uint8ClampedArray(src.length);

        // Pass 1: Horizontal Pass
        for (let y = 0; y < h; y++) {
            let rSum = 0, gSum = 0, bSum = 0, count = 0;
            
            // Initialize window
            for (let k = -radius; k <= radius; k++) {
                const nx = Math.min(w - 1, Math.max(0, k));
                const idx = (y * w + nx) * 4;
                rSum += src[idx];
                gSum += src[idx + 1];
                bSum += src[idx + 2];
                count++;
            }

            for (let x = 0; x < w; x++) {
                const outIdx = (y * w + x) * 4;
                temp[outIdx]     = rSum / count;
                temp[outIdx + 1] = gSum / count;
                temp[outIdx + 2] = bSum / count;

                // Slide window forward safely
                const oldX = Math.min(w - 1, Math.max(0, x - radius));
                const newX = Math.min(w - 1, Math.max(0, x + radius + 1));
                
                const oldIdx = (y * w + oldX) * 4;
                const newIdx = (y * w + newX) * 4;

                rSum += src[newIdx] - src[oldIdx];
                gSum += src[newIdx + 1] - src[oldIdx + 1];
                bSum += src[newIdx + 2] - src[oldIdx + 2];
            }
        }

        // Pass 2: Vertical Pass
        for (let x = 0; x < w; x++) {
            let rSum = 0, gSum = 0, bSum = 0, count = 0;

            // Initialize window
            for (let k = -radius; k <= radius; k++) {
                const ny = Math.min(h - 1, Math.max(0, k));
                const idx = (ny * w + x) * 4;
                rSum += temp[idx];
                gSum += temp[idx + 1];
                bSum += temp[idx + 2];
                count++;
            }

            for (let y = 0; y < h; y++) {
                const outIdx = (y * w + x) * 4;
                dst[outIdx]     = rSum / count;
                dst[outIdx + 1] = gSum / count;
                dst[outIdx + 2] = bSum / count;

                // Slide window down safely
                const oldY = Math.min(h - 1, Math.max(0, y - radius));
                const newY = Math.min(h - 1, Math.max(0, y + radius + 1));

                const oldIdx = (oldY * w + x) * 4;
                const newIdx = (newY * w + x) * 4;

                rSum += temp[newIdx] - temp[oldIdx];
                gSum += temp[newIdx + 1] - temp[oldIdx + 1];
                bSum += temp[newIdx + 2] - temp[oldIdx + 2];
            }
        }
    }
};
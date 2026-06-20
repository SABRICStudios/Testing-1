/**
 * Tools/Details/OPERATIONS/color_noise.js
 * Advanced Frequency-Separated Chrominance Noise Filter
 */

window.DetailsColorDenoise = {
    apply(imgData, colorAmount) {
        const width = imgData.width;
        const height = imgData.height;
        const src = imgData.data;
        
        const output = new ImageData(new Uint8ClampedArray(src), width, height);
        const dst = output.data;

        const factor = colorAmount / 100;
        
        // Allocate isolated single-channel buffers for the color channels (Cb and Cr)
        const cbBuffer = new Float32Array(width * height);
        const crBuffer = new Float32Array(width * height);
        const lumaBuffer = new Float32Array(width * height);

        // Step A: Convert the entire image array into the YCbCr color channel space
        for (let i = 0; i < src.length; i += 4) {
            const r = src[i];
            const g = src[i + 1];
            const b = src[i + 2];
            const pixIdx = i / 4;

            lumaBuffer[pixIdx] = 0.299 * r + 0.587 * g + 0.114 * b; // Y (Brightness)
            cbBuffer[pixIdx]   = -0.1687 * r - 0.3313 * g + 0.5 * b;   // Cb (Blue Chroma)
            crBuffer[pixIdx]   = 0.5 * r - 0.4187 * g - 0.0813 * b;    // Cr (Red Chroma)
        }

        // Step B: Create heavily blurred copies of our color-only buffers
        const blurredCb = new Float32Array(width * height);
        const blurredCr = new Float32Array(width * height);
        
        // Lightroom uses a large blur radius (4px) specifically on colors to wipe out color splotches
        this.boxBlurChannel(cbBuffer, blurredCb, width, height, 4);
        this.boxBlurChannel(crBuffer, blurredCr, width, height, 4);

        // Step C: Merge the original sharp brightness channel with the blurred color channels
        for (let i = 0; i < src.length; i += 4) {
            const pixIdx = i / 4;
            const Y = lumaBuffer[pixIdx];

            // Blend based on the slider value
            const finalCb = cbBuffer[pixIdx] * (1 - factor) + blurredCb[pixIdx] * factor;
            const finalCr = crBuffer[pixIdx] * (1 - factor) + blurredCr[pixIdx] * factor;

            // Reconvert back to RGB channels for rendering
            dst[i]     = Math.max(0, Math.min(255, Y + 1.402 * finalCr));
            dst[i + 1] = Math.max(0, Math.min(255, Y - 0.34414 * finalCb - 0.71414 * finalCr));
            dst[i + 2] = Math.max(0, Math.min(255, Y + 1.772 * finalCb));
        }

        return output;
    },

    // High performance mathematical single-channel blur mechanism
    boxBlurChannel(srcChan, dstChan, w, h, radius) {
        // Horizontal Pass
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let sum = 0, count = 0;
                for (let k = -radius; k <= radius; k++) {
                    const nx = x + k;
                    if (nx >= 0 && nx < w) {
                        sum += srcChan[y * w + nx];
                        count++;
                    }
                }
                dstChan[y * w + x] = sum / count;
            }
        }
        
        // Vertical Pass overwriting back into place
        const temp = new Float32Array(dstChan);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let sum = 0, count = 0;
                for (let k = -radius; k <= radius; k++) {
                    const ny = y + k;
                    if (ny >= 0 && ny < h) {
                        sum += temp[ny * w + x];
                        count++;
                    }
                }
                dstChan[y * w + x] = sum / count;
            }
        }
    }
};
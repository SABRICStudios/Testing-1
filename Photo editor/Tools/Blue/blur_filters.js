// Tools/Blur/blur_filters.js

const BlurFilters = {
    /**
     * High-performance high-resolution Gaussian blur using fast native offscreen contexts
     */
    applyGaussian(srcImageData, bufferCanvas, radius) {
        const ctx = bufferCanvas.getContext('2d');
        const w = bufferCanvas.width;
        const h = bufferCanvas.height;

        // Clear and restore original canvas image array onto target block
        ctx.putImageData(srcImageData, 0, 0);

        if (radius === 0) return;

        // Create secondary temp canvas loop matrix to prevent visual bleeding artefacts
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        tempCanvas.getContext('2d').putImageData(srcImageData, 0, 0);

        ctx.clearRect(0, 0, w, h);
        ctx.save();
        ctx.filter = `blur(${radius}px)`;
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();
    },

    /**
     * High-precision iterative zoom/radial depth blur focused towards center coordinates
     */
    applyRadialDepth(srcImageData, bufferCanvas, intensity) {
        const ctx = bufferCanvas.getContext('2d');
        const w = bufferCanvas.width;
        const h = bufferCanvas.height;

        ctx.putImageData(srcImageData, 0, 0);

        if (intensity === 0) return;

        // Generate clean reference buffer image
        const offscreen = document.createElement('canvas');
        offscreen.width = w;
        offscreen.height = h;
        offscreen.getContext('2d').putImageData(srcImageData, 0, 0);

        ctx.clearRect(0, 0, w, h);
        ctx.save();

        const steps = 12; // Controls clarity resolution vs computing frame rate
        const factor = intensity / 800; // Normalizes step offset speed scale
        const centerX = w / 2;
        const centerY = h / 2;

        // Accumulative alpha stacking blend loops
        ctx.globalAlpha = 1 / steps;
        for (let i = 0; i < steps; i++) {
            const scale = 1 + (i * factor);
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.scale(scale, scale);
            ctx.translate(-centerX, -centerY);
            ctx.drawImage(offscreen, 0, 0);
            ctx.restore();
        }
        ctx.restore();
    }
};
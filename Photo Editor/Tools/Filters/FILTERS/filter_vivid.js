/**
 * Visuals Filter - Vivid (Upgraded)
 * Optimized digital luminance color matrix boost.
 */
(() => {
    const VividFilter = {
        applyPixel(r, g, b, buffer) {
            const vLuma = 0.299 * r + 0.587 * g + 0.114 * b;
            buffer.r = vLuma + (r - vLuma) * 1.6;
            buffer.g = vLuma + (g - vLuma) * 1.6;
            buffer.b = vLuma + (b - vLuma) * 1.6;
        }
    };
    window.FilterEngine.register('vivid', VividFilter);
})();
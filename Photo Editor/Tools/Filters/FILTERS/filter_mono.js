/**
 * Visuals Filter - Monochrome (Upgraded)
 * Strict structural grayscale human eye luminance values.
 */
(() => {
    const MonoFilter = {
        applyPixel(r, g, b, buffer) {
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            buffer.r = gray;
            buffer.g = gray;
            buffer.b = gray;
        }
    };
    window.FilterEngine.register('mono', MonoFilter);
})();
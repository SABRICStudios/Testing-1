/**
 * Visuals Filter - Invert (Upgraded)
 * Inverse mathematical subtraction mapping.
 */
(() => {
    const InvertFilter = {
        applyPixel(r, g, b, buffer) {
            buffer.r = 255 - r;
            buffer.g = 255 - g;
            buffer.b = 255 - b;
        }
    };
    window.FilterEngine.register('invert', InvertFilter);
})();
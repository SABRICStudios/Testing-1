/**
 * Visuals Filter - Sepia (Upgraded)
 * Standard historic warm tone matrix distributions.
 */
(() => {
    const SepiaFilter = {
        applyPixel(r, g, b, buffer) {
            buffer.r = (r * 0.393) + (g * 0.769) + (b * 0.189);
            buffer.g = (r * 0.349) + (g * 0.686) + (b * 0.168);
            buffer.b = (r * 0.272) + (g * 0.534) + (b * 0.131);
        }
    };
    window.FilterEngine.register('sepia', SepiaFilter);
})();
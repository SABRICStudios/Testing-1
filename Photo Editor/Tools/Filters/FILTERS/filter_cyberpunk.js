/**
 * Visuals Filter - Cyberpunk (Upgraded)
 * Cross-channel color shifting for bright neon/synthetic tones.
 */
(() => {
    const CyberpunkFilter = {
        applyPixel(r, g, b, buffer) {
            buffer.r = r * 1.3;
            buffer.g = g * 0.7;
            buffer.b = b * 1.4;
        }
    };
    window.FilterEngine.register('cyberpunk', CyberpunkFilter);
})();
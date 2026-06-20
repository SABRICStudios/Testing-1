/**
 * Visuals Filter - Cinematic (Upgraded)
 * Cool shadow matrix cross distribution.
 */
(() => {
    const CinematicFilter = {
        applyPixel(r, g, b, buffer) {
            buffer.r = r * 0.9;
            buffer.g = g * 0.95;
            buffer.b = b * 1.2;
        }
    };
    window.FilterEngine.register('cinematic', CinematicFilter);
})();
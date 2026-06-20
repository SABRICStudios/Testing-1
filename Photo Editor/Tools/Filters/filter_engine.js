/**
 * Visuals Photo Editor - Filter Engine Module (Upgraded Modular Version)
 * Ultra-high-performance, non-destructive pixel manipulation gateway.
 * Optimized to eliminate function call overhead and memory allocation inside core loops.
 */
const FilterEngine = {
    // Registry holding individual filter algorithms
    registry: {},

    // Reusable shared memory buffer to prevent object allocation overhead during pixel transforms
    pixelBuffer: { r: 0, g: 0, b: 0 },

    /**
     * Registers a standalone filter script matrix.
     * @param {string} id - Unique identifier (e.g., 'vivid', 'cyberpunk')
     * @param {Object} filterModule - Object containing filter implementation layers.
     */
    register(id, filterModule) {
        this.registry[id] = filterModule;
    },

    /**
     * Core processing gateway.
     * @param {ImageData} imageData - The structural raw canvas matrix clone.
     * @param {string} filterType - Target filter string profile identifier.
     * @param {number} intensity - Factor scale parameter ranging from 0 to 100.
     * @returns {ImageData} The updated image data structure array.
     */
    process(imageData, filterType, intensity) {
        // Early return if no processing is required[cite: 2, 4]
        if (!imageData || filterType === 'none' || intensity === 0) {
            return imageData; //[cite: 2, 4]
        }

        const filter = this.registry[filterType];
        if (!filter) {
            console.warn(`Filter profile '${filterType}' is not registered.`); //
            return imageData; //[cite: 4]
        }

        const factor = intensity / 100; //[cite: 2, 4]
        const data = imageData.data; //[cite: 2, 4]
        const len = data.length; //[cite: 2, 4]

        // SCENARIO A: Optimization Phase - Filter provides a bulk layout processor (Fastest)
        // Allows advanced filters to manage their own loops, utilize WebGL, or skip internal blending functions.
        if (typeof filter.processBulk === 'function') {
            return filter.processBulk(imageData, factor);
        }

        // SCENARIO B: Performance Phase - Direct reference caching loop
        // By pulling the function out of the object before looping, JS engines (V8) can inline it cleanly.
        const applyPixel = filter.applyPixel;
        const buf = this.pixelBuffer; 

        // Run high-speed micro-optimization iterations across the continuous linear pixel grid[cite: 2]
        for (let i = 0; i < len; i += 4) {
            const r = data[i];     //[cite: 2, 4]
            const g = data[i + 1]; //[cite: 2, 4]
            const b = data[i + 2]; //[cite: 2, 4]

            // Pass the reusable buffer object to mutate state directly without creating garbage collection overhead
            applyPixel(r, g, b, buf);

            // High-performance Inline Vector Blending Equation & Clamping[cite: 2, 4]
            // Final = (Target * factor) + (Original * (1 - factor))[cite: 2]
            data[i]     = Math.min(255, Math.max(0, (buf.r * factor) + (r * (1 - factor)))); //[cite: 2, 4]
            data[i + 1] = Math.min(255, Math.max(0, (buf.g * factor) + (g * (1 - factor)))); //[cite: 2, 4]
            data[i + 2] = Math.min(255, Math.max(0, (buf.b * factor) + (b * (1 - factor)))); //[cite: 2, 4]
        }

        return imageData; //[cite: 2]
    }
};

// Export to window object space for global cross-module architecture access[cite: 2]
window.FilterEngine = FilterEngine; //[cite: 2, 4]
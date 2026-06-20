/**
 * Tools/Details/details_pipeline.js
 * Central Assembly Orchestrator passing pixel data through individual detail operators
 */

window.DetailsEngine = {
    /**
     * Pipeline processing function executed during live preview rendering loops
     */
    process(imgData, settings) {
        if (!imgData || !settings) return imgData;

        // Clone context variables safely to bypass shared structural side-effects
        let workingData = imgData;

        // 1. RUN EDGE ISOLATION MASKING GENERATOR
        let edgeMaskArray = null;
        if (settings.sharpenMasking > 0 && window.DetailsMasking && typeof window.DetailsMasking.generate === 'function') {
            edgeMaskArray = window.DetailsMasking.generate(workingData, settings.sharpenMasking);
        }

        // 2. RUN TRUE RADIUS UNSHARP MASK SHARPENING
        if (settings.sharpenAmount > 0 && window.DetailsSharpen && typeof window.DetailsSharpen.apply === 'function') {
            workingData = window.DetailsSharpen.apply(workingData, settings, edgeMaskArray);
        }

        // 3. RUN LUMINANCE NOISE REDUCTION
        if (settings.noiseLuminance > 0 && window.DetailsLumaDenoise && typeof window.DetailsLumaDenoise.apply === 'function') {
            workingData = window.DetailsLumaDenoise.apply(workingData, settings.noiseLuminance, settings.noiseLumDetail);
        }

        // 4. RUN COLOR CHROMINANCE DENOISE
        if (settings.noiseColor > 0 && window.DetailsColorDenoise && typeof window.DetailsColorDenoise.apply === 'function') {
            workingData = window.DetailsColorDenoise.apply(workingData, settings.noiseColor);
        }

        return workingData;
    }
};
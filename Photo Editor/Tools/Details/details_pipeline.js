

window.DetailsEngine = {
    /**
     * Executes consecutive details filtering passes sequentially.
     * Order: Denoise backgrounds clean first -> Sharpen remaining edges last.
     */
    process(imgData, settings) {
        if (!imgData || !settings) return imgData;

        let workingData = imgData;

        // 1. RUN EDGE ISOLATION MASKING GENERATOR
        let edgeMaskArray = null;
        if (settings.sharpenMasking > 0 && window.DetailsMasking && typeof window.DetailsMasking.generate === 'function') {
            edgeMaskArray = window.DetailsMasking.generate(workingData, settings.sharpenMasking);
        }

        // 2. RUN LUMINANCE NOISE REDUCTION
        if (settings.noiseLuminance > 0 && window.DetailsLumaDenoise && typeof window.DetailsLumaDenoise.apply === 'function') {
            const detailValue = settings.noiseLumDetail !== undefined ? settings.noiseLumDetail : settings.noiseLuminanceDetail;
            workingData = window.DetailsLumaDenoise.apply(workingData, settings.noiseLuminance, detailValue);
        }

        // 3. RUN COLOR CHROMINANCE DENOISE
        if (settings.noiseColor > 0 && window.DetailsColorDenoise && typeof window.DetailsColorDenoise.apply === 'function') {
            // Forward both the color strength and detail properties to the engine
            const colorDetailValue = settings.noiseColorDetail !== undefined ? settings.noiseColorDetail : 50;
            workingData = window.DetailsColorDenoise.apply(workingData, settings.noiseColor, colorDetailValue);
        }

        // 4. RUN TRUE RADIUS UNSHARP MASK SHARPENING
        if (settings.sharpenAmount > 0 && window.DetailsSharpen && typeof window.DetailsSharpen.apply === 'function') {
            workingData = window.DetailsSharpen.apply(workingData, settings, edgeMaskArray);
        }

        return workingData;
    }
};

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
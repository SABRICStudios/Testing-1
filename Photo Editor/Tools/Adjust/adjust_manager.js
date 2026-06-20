// adjust_manager.js
document.addEventListener('DOMContentLoaded', () => {
    const adjustBtn = document.getElementById('adjustBtn');
    const adjustPanel = document.getElementById('adjustPanel');
    const adjustGallery = document.getElementById('adjustGallery');
    
    // Track the currently open slider so we know what to hide/show globally
    let activeSliderControl = null;

    // Toggle main view settings panel container drawer
    adjustBtn.addEventListener('click', () => {
        if (adjustPanel.style.display === 'none' || !adjustPanel.style.display) {
            adjustPanel.style.display = 'block';
            adjustGallery.style.display = 'flex'; 
            if (activeSliderControl) activeSliderControl.style.display = 'none';
        } else {
            adjustPanel.style.display = 'none';
        }
    });

    // Dynamic event listener for ALL tool buttons inside the gallery
    adjustGallery.addEventListener('click', (e) => {
        // Find the closest button element if they clicked the icon or span text inside it
        const targetBtn = e.target.closest('.gallery-item-btn');
        if (!targetBtn) return;

        const targetSliderId = targetBtn.getAttribute('data-target');
        const targetSlider = document.getElementById(targetSliderId);

        if (targetSlider) {
            adjustGallery.style.display = 'none';              
            targetSlider.style.display = 'block';    
            activeSliderControl = targetSlider; // Save reference to close it later
        }
    });
});

window.ExposureAdjustment = ExposureAdjustment;
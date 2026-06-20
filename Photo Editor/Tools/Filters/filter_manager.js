/**
 * Visuals Photo Editor - Filter Manager Module (Upgraded Version)
 * Handles UI interactions, intensity tracking, and live canvas previewing for filters.
 */
class FilterManager {
    constructor() {
        // --- UI Element Selectors ---
        this.filtersBtn = document.getElementById('filtersBtn');
        this.filterPanel = document.getElementById('filterPanel');
        this.filterGallery = document.getElementById('filterGallery');
        
        this.filterSlider = document.getElementById('filterIntensitySlider');
        this.filterLabel = document.getElementById('activeFilterLabel');
        
        // Action Transactions
        this.confirmBtn = document.getElementById('confirmFilterBtn');
        this.discardBtn = document.getElementById('discardFilterBtn');
        
        // Main Editor Components
        this.canvas = document.getElementById('editorCanvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

        // --- State Management ---
        this.activeFilter = 'none';
        this.intensity = 100;

        // PERFORMANCE LOCK: Prevents input scrubbing events from reacting 
        // to global synchronization loops that it initiated itself.
        this.isLocalUpdateActive = false;

        // Initialize event listeners if core entry elements exist
        if (this.filtersBtn) {
            this.init();
        } else {
            console.warn("Filters entry button '#filtersBtn' not found in HTML DOM.");
        }
    }

    init() {
        // Toggle Filter Panel View
        this.filtersBtn.addEventListener('click', () => {
            if (!this.filterPanel) return;
            if (this.filterPanel.style.display === 'none' || !this.filterPanel.style.display) {
                this.filterPanel.style.display = 'block';
                this.openFilterSession();
            } else {
                this.filterPanel.style.display = 'none';
            }
        });

        const filterCards = document.querySelectorAll('.filter-item-btn');
        if (filterCards.length === 0) {
            console.warn("No elements matching '.filter-item-btn' found in your HTML markup.");
        }

        filterCards.forEach(card => {
            card.addEventListener('click', () => {
                this.activeFilter = card.getAttribute('data-filter') || 'none';
                this.intensity = 100;
                
                if (this.filterSlider) {
                    this.filterSlider.value = 100;
                }
                
                // Synchronize label based on selected element
                this.updateSliderLabel(card);

                // Hide gallery to give room to the intensity panel adjustments
                if (this.filterGallery) {
                    this.filterGallery.style.display = 'none';
                }
                
                // Show intensity adjustment layout controls
                const intensityWrapper = document.getElementById('filterIntensityControl') || document.querySelector('.slider-group');
                if (intensityWrapper) {
                    intensityWrapper.style.display = 'block';
                }

                this.applyLivePreview();
            });
        });

        // --- ADDED: Listen for slider movements ---
        if (this.filterSlider) {
            this.filterSlider.addEventListener('input', (e) => {
                this.intensity = parseInt(e.target.value, 10);
                
                // Keep the label text updated with the filter name while sliding
                const matchingCard = document.querySelector(`.filter-item-btn[data-filter="${this.activeFilter}"]`);
                this.updateSliderLabel(matchingCard);
                
                // Trigger the live preview rendering
                this.applyLivePreview();
            });
        }

        // Action Commit Buttons
        if (this.confirmBtn) {
            this.confirmBtn.addEventListener('click', () => this.confirmFilterTransaction());
        }
        if (this.discardBtn) {
            this.discardBtn.addEventListener('click', () => this.discardFilterTransaction());
        }

        // Synchronize local variables AND UI views on global Undo/Redo actions
        window.addEventListener('editorHistoryChanged', () => {
            if (this.isLocalUpdateActive) return;

            if (window.HistoryManager) {
                const params = window.HistoryManager.getCurrentParameters();
                const current = params ? params.filter : null;
                if (current) {
                    this.activeFilter = current.type || 'none';
                    this.intensity = typeof current.intensity !== 'undefined' ? current.intensity : 100;
                    
                    if (this.filterSlider) {
                        this.filterSlider.value = this.intensity;
                    }
                    
                    const matchingCard = document.querySelector(`.filter-item-btn[data-filter="${this.activeFilter}"]`);
                    this.updateSliderLabel(matchingCard);
                }
            }
        });
    }

    /**
     * Updates text node contexts gracefully to reflect changes in filter selection states
     */
    updateSliderLabel(activeCardElement) {
        if (!this.filterLabel) return;
        
        let titleText = this.activeFilter.charAt(0).toUpperCase() + this.activeFilter.slice(1);
        if (activeCardElement) {
            titleText = activeCardElement.querySelector('span')?.innerText || titleText;
        }
        // Shows "Sepia Intensity (80%)" instead of just "Sepia Intensity"
        this.filterLabel.innerText = `${titleText} Intensity (${this.intensity}%)`;
    }

openFilterSession() {
        if (window.HistoryManager) {
            const confirmedMatrix = window.HistoryManager.getCurrentParameters();
            if (confirmedMatrix && confirmedMatrix.filter) {
                this.activeFilter = confirmedMatrix.filter.type || 'none';
                this.intensity = typeof confirmedMatrix.filter.intensity !== 'undefined' ? confirmedMatrix.filter.intensity : 100;
            } else {
                this.activeFilter = 'none';
                this.intensity = 100;
            }
        }

        // FIXED: Force the physical UI slider element to match the loaded intensity state
        if (this.filterSlider) {
            this.filterSlider.value = this.intensity;
        }

        // FIXED: Synchronize the text label reading to show correct historical percentages
        const matchingCard = document.querySelector(`.filter-item-btn[data-filter="${this.activeFilter}"]`);
        this.updateSliderLabel(matchingCard);

        if (this.filterGallery) {
            this.filterGallery.style.display = 'flex';
        }
        const intensityWrapper = document.getElementById('filterIntensityControl') || document.querySelector('.slider-group');
        if (intensityWrapper) {
            intensityWrapper.style.display = 'none';
        }
    }

    applyLivePreview() {
        if (window.BaselineFilterHistory) {
            window.BaselineFilterHistory.updateLivePreviewValues(this.activeFilter, this.intensity);
        }
        
        this.isLocalUpdateActive = true;
        window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
        this.isLocalUpdateActive = false; 

        if (window.CanvasEditor && typeof window.CanvasEditor.applyEffectsPipeline === 'function') {
            window.CanvasEditor.applyEffectsPipeline();
        }
    }

    confirmFilterTransaction() {
        if (window.BaselineFilterHistory) {
            const filterName = this.activeFilter.charAt(0).toUpperCase() + this.activeFilter.slice(1);
            window.BaselineFilterHistory.commitToMaster(`Filter: ${filterName}`);
        }
        this.resetUIComponents();
    }

    discardFilterTransaction() {
        if (window.HistoryManager) {
            const confirmedMatrix = window.HistoryManager.getCurrentParameters();
            if (confirmedMatrix && confirmedMatrix.filter) {
                this.activeFilter = confirmedMatrix.filter.type || 'none';
                this.intensity = confirmedMatrix.filter.intensity !== undefined ? confirmedMatrix.filter.intensity : 100;
                
                if (window.BaselineFilterHistory) {
                    window.BaselineFilterHistory.syncState(confirmedMatrix.filter);
                }
            }
        }
        window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
        this.resetUIComponents();
    }

    resetUIComponents() {
        if (this.filterGallery) {
            this.filterGallery.style.display = 'flex';
        }
        const intensityWrapper = document.getElementById('filterIntensityControl') || document.querySelector('.slider-group');
        if (intensityWrapper) {
            intensityWrapper.style.display = 'none';
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.AppFilterManager = new FilterManager();
});
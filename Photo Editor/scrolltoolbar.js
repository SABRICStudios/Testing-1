/**
 * Visuals Editor - Advanced Kinetic Toolbar Scroller
 * Handles smooth inertial dragging, wheel conversion, and boundary snap interactions.
 */

class ScrollToolbar {
    constructor(elementId) {
        this.toolbar = document.getElementById(elementId);
        if (!this.toolbar) return;

        // Interaction States
        this.isDragging = false;
        this.startX = 0;
        this.scrollStartX = 0;

        // Velocity Tracking Coordinates
        this.velocityX = 0;
        this.lastMoveTime = 0;
        this.lastMoveX = 0;
        this.rafId = null;

        this.init();
    }

init() {
        // Desktop Mouse Click & Drag
        this.toolbar.addEventListener('mousedown', (e) => this.dragStart(e));
        window.addEventListener('mousemove', (e) => this.dragMove(e));
        window.addEventListener('mouseup', () => this.dragEnd());
        
        // Boundaries Fallback Safeguard
        this.toolbar.addEventListener('mouseleave', () => this.dragEnd());

        // Standard Mouse Wheel Vector Translation
        this.toolbar.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

        // --- NEW: Mobile Touch Events ---
        this.toolbar.addEventListener('touchstart', (e) => this.dragStart(e), { passive: true });
        window.addEventListener('touchmove', (e) => this.dragMove(e), { passive: false });
        window.addEventListener('touchend', () => this.dragEnd());

        // Touch Prevention Override (Keeps mobile trackpad scrolling clean)
        this.toolbar.style.webkitOverflowScrolling = 'touch';
    }
    dragStart(e) {
        this.isDragging = true;
        this.toolbar.classList.add('dragging');
        const pageX = e.type.includes('touch') ? e.touches[0].pageX : e.pageX;
        // Cancel active kinetic animations smoothly on click down
        if (this.rafId) cancelAnimationFrame(this.rafId);

        this.startX = e.pageX - this.toolbar.offsetLeft;
        this.scrollStartX = this.toolbar.scrollLeft;

        // Reset tracking mechanics
        this.lastMoveX = e.pageX;
        this.lastMoveTime = performance.now();
        this.velocityX = 0;
    }

    dragMove(e) {
        if (!this.isDragging) return;
        e.preventDefault();

        const currentX = e.pageX - this.toolbar.offsetLeft;
        const deltaX = (currentX - this.startX) * 1.2; // 1.2x Responsiveness scalar
        const pageX = e.type.includes('touch') ? e.touches[0].pageX : e.pageX;
        this.toolbar.scrollLeft = this.scrollStartX - deltaX;

        // Calculate Real-time Instantaneous Velocity Matrix
        const now = performance.now();
        const elapsed = now - this.lastMoveTime;
        
        if (elapsed > 0) {
            const currentPositionX = e.pageX;
            // Pixels covered per millisecond
            this.velocityX = (currentPositionX - this.lastMoveX) / elapsed;
            this.lastMoveX = currentPositionX;
            this.lastMoveTime = now;
        }
    }

    dragEnd() {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.toolbar.classList.remove('dragging');

        // Apply Kinetic Friction Deceleration Loop if velocity threshold met
        if (Math.abs(this.velocityX) > 0.1) {
            this.applyMomentum();
        }
    }

    applyMomentum() {
        if (Math.abs(this.velocityX) < 0.05) {
            return; // Target stopped
        }

        // 0.95 Friction Coefficient (Higher = slides further, Lower = stiffer stops)
        this.velocityX *= 0.95; 
        this.toolbar.scrollLeft -= this.velocityX * 16; // 16ms estimated frame target

        this.rafId = requestAnimationFrame(() => this.applyMomentum());
    }

    handleWheel(e) {
        // Only override standard behavior if it's a vertical scroll action
        if (e.deltaY !== 0) {
            e.preventDefault();
            
            if (this.rafId) cancelAnimationFrame(this.rafId);
            
            this.toolbar.scrollBy({
                left: e.deltaY * 0.85, // Scale scroll depth down slightly for tracking control
                behavior: 'auto'      // 'auto' ensures continuous mouse wheel stepping feels responsive
            });
        }
    }
}

// Auto-initialize layout frame when document model parses
document.addEventListener('DOMContentLoaded', () => {
    new ScrollToolbar('toolbar');
});

this.toolbar.scrollLeft = 0;
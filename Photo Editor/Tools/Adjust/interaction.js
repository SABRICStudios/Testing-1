// interaction_manager.js - Handles Moving & Scaling Transformations

window.InteractionManager = {
    isDragging: false,
    isResizing: false,
    resizeHandle: null,
    startX: 0,
    startY: 0,

    getHandlePositions() {
        const state = window.imgState;
        const offset = state.handleSize / 2;
        return {
            tl: { x: state.x - offset, y: state.y - offset, name: 'tl' },
            tr: { x: state.x + state.width - offset, y: state.y - offset, name: 'tr' },
            bl: { x: state.x - offset, y: state.y + state.height - offset, name: 'bl' },
            br: { x: state.x + state.width - offset, y: state.y + state.height - offset, name: 'br' }
        };
    },

    getPointerPos(e, canvas) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    },

    // --- NEW METHOD TO RESET TRACKING STATE POST-CROP ---
    resetStateForCroppedImage(newWidth, newHeight) {
        if (!window.imgState) return;
        
        // 1. Reset positional coordinates to fit perfectly in top-left of new canvas frame
        window.imgState.x = 0;
        window.imgState.y = 0;
        
        // 2. Lock the state tracking widths to match the newly isolated dimension matrix
        window.imgState.width = newWidth;
        window.imgState.height = newHeight;
        
        // 3. Keep it selected so handles show up immediately
        window.imgState.isSelected = true;

        console.log(`Interaction Manager synced to cropped image: ${newWidth}x${newHeight}`);
    }
};

// interaction.js

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('editorCanvas');
    const IM = window.InteractionManager;

    // A clean check to see if the mixer tool has control
    function isMixerActive() {
        return window.MixerEditor && window.MixerEditor.isOpen;
    }

    function handlePointerDown(e) {
        // FIX: Just return early. Do not kill the event so the mixer engine can catch it.
        if (isMixerActive()) {
            return;
        }

        if (!window.imgState || !window.imgState.img) return;
        const pos = IM.getPointerPos(e, canvas);
        const state = window.imgState;
        
        let hitHandle = null;
        if (state.isSelected) {
            const handles = IM.getHandlePositions();
            for (let key in handles) {
                const h = handles[key];
                if (pos.x >= h.x && pos.x <= h.x + state.handleSize && pos.y >= h.y && pos.y <= h.y + state.handleSize) {
                    hitHandle = h.name;
                    break;
                }
            }
        }

        const hitImageBody = (pos.x >= state.x && pos.x <= state.x + state.width && 
                              pos.y >= state.y && pos.y <= state.y + state.height);

        if (hitHandle) {
            IM.isResizing = true;
            IM.resizeHandle = hitHandle;
        } else if (hitImageBody) {
            state.isSelected = true;
            IM.isDragging = true;
        } else {
            state.isSelected = false;
        }

        IM.startX = pos.x;
        IM.startY = pos.y;
        if (window.CanvasEditor && typeof window.CanvasEditor.redraw === 'function') {
            window.CanvasEditor.redraw();
        }
    }

    function handlePointerMove(e) {
        // FIX: Just return early. Do not kill the event so the mixer engine can paint.
        if (isMixerActive()) {
            return;
        }

        if (!window.imgState || !window.imgState.img) return;
        const pos = IM.getPointerPos(e, canvas);
        const state = window.imgState;
        
        const dx = pos.x - IM.startX;
        const dy = pos.y - IM.startY;

        const hitImageBody = (pos.x >= state.x && pos.x <= state.x + state.width && pos.y >= state.y && pos.y <= state.y + state.height);

        if (!IM.isDragging && !IM.isResizing) {
            if (state.isSelected) {
                const handles = IM.getHandlePositions();
                let hoveringHandle = false;
                for (let key in handles) {
                    const h = handles[key];
                    if (pos.x >= h.x && pos.x <= h.x + state.handleSize && pos.y >= h.y && pos.y <= h.y + state.handleSize) {
                        hoveringHandle = true;
                        break;
                    }
                }
                if (hoveringHandle) {
                    canvas.style.cursor = 'nwse-resize';
                    return;
                }
            }
            canvas.style.cursor = hitImageBody ? 'pointer' : 'default';
            return;
        }

        if (IM.isDragging && state.isSelected) {
            state.x += dx;
            state.y += dy;
        } 
        else if (IM.isResizing && state.isSelected) {
            const h = IM.resizeHandle;
            
            if (h === 'br') {
                state.width = Math.max(20, state.width + dx);
                state.height = Math.max(20, state.height + dy);
            } else if (h === 'bl') {
                const oldW = state.width;
                state.width = Math.max(20, state.width - dx);
                state.x += (oldW - state.width);
                state.height = Math.max(20, state.height + dy);
            } else if (h === 'tr') {
                state.width = Math.max(20, state.width + dx);
                const oldH = state.height;
                state.height = Math.max(20, state.height - dy);
                state.y += (oldH - state.height);
            } else if (h === 'tl') {
                const oldW = state.width;
                const oldH = state.height;
                state.width = Math.max(20, state.width - dx);
                state.height = Math.max(20, state.height - dy);
                state.x += (oldW - state.width);
                state.y += (oldH - state.height);
            }
        }

        IM.startX = pos.x;
        IM.startY = pos.y;
        if (window.CanvasEditor && typeof window.CanvasEditor.redraw === 'function') {
            window.CanvasEditor.redraw();
        }
    }

    function handlePointerUp() {
        if (isMixerActive()) return;

        IM.isDragging = false;
        IM.isResizing = false;
        IM.resizeHandle = null;
        if (window.CanvasEditor && typeof window.CanvasEditor.redraw === 'function') {
            window.CanvasEditor.redraw();
        }
    }

    // --- ENHANCEMENT: WRAP TOUCH LISTENERS TO STOP TOUCH EVENT PASS-THROUGHS ---
    canvas.addEventListener('mousedown', handlePointerDown, true); 
    window.addEventListener('mousemove', handlePointerMove, true); 
    window.addEventListener('mouseup', handlePointerUp, true);

    canvas.addEventListener('touchstart', (e) => {
        if (isMixerActive()) return; 
        handlePointerDown(e);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (isMixerActive()) return; // Let touch events pass through to mixer engine on mobile
        handlePointerMove(e);
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
        if (isMixerActive()) return;
        handlePointerUp();
    });
});
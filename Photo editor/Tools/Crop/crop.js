// Tools/Crop/crop.js

const CropTool = {
    // Main application canvas references
    mainCanvas: null,
    mainCtx: null,

    // Modal workspace DOM element references
    modal: null,
    cropCanvas: null,
    cropCtx: null,
    confirmBtn: null,
    cancelBtn: null,

    // Cropping interactive state variables
    isDrawing: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    backupImageData: null, 
    
    // Calculated final selection parameters
    cropBox: { x: 0, y: 0, width: 0, height: 0 },

    // Explicit event bindings
    boundMouseDown: null,
    boundMouseMove: null,
    boundMouseUp: null,

    init(mainCanvasId) {
        this.mainCanvas = document.getElementById(mainCanvasId);
        if (!this.mainCanvas) return;
        this.mainCtx = this.mainCanvas.getContext('2d');
        
        // Cache Modal Interface UI assets
        this.modal = document.getElementById('cropModal');
        this.cropCanvas = document.getElementById('modalCropCanvas');
        if (this.cropCanvas) {
            this.cropCtx = this.cropCanvas.getContext('2d');
        }
        this.confirmBtn = document.getElementById('confirmCropBtn');
        this.cancelBtn = document.getElementById('cancelCropBtn');

        // Explicitly bind handlers so references remain uniform across actions
        this.boundMouseDown = this.onMouseDown.bind(this);
        this.boundMouseMove = this.onMouseMove.bind(this);
        this.boundMouseUp = this.onMouseUp.bind(this);

        this.bindEvents();
    },

    bindEvents() {
        const cropBtn = document.getElementById('cropBtn');
        if (cropBtn) {
            cropBtn.addEventListener('click', () => this.activateModal());
        }

        if (this.confirmBtn) {
            this.confirmBtn.addEventListener('click', () => this.executeCrop());
        }

        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', () => this.closeModal());
        }
    },

    activateModal() {
        if (!this.modal || !this.cropCanvas) return;

        console.log("Opening Crop Workspace...");
        
        // 1. Sync the modal workspace canvas scale perfectly to match your current image state
        this.cropCanvas.width = this.mainCanvas.width;
        this.cropCanvas.height = this.mainCanvas.height;

        // 2. Clone the visual pixel array data directly into the modal workspace view canvas
        this.cropCtx.drawImage(this.mainCanvas, 0, 0);

        // 3. Cache a clean base image state snapshot before rendering any markup UI shapes on it
        this.backupImageData = this.cropCtx.getImageData(0, 0, this.cropCanvas.width, this.cropCanvas.height);

        // Reset default cropping bounding metrics
        this.cropBox = { x: 0, y: 0, width: 0, height: 0 };
        this.cropCanvas.style.cursor = 'crosshair';

        // 4. Reveal the hidden workspace modal layer layout container to screen viewports
        this.modal.style.display = 'flex';

        // 5. Mount UI input listener attachments to track mouse drawing over interactive view
        this.cropCanvas.addEventListener('mousedown', this.boundMouseDown);
        this.cropCanvas.addEventListener('mousemove', this.boundMouseMove);
        window.addEventListener('mouseup', this.boundMouseUp);
    },

    closeModal() {
        if (!this.modal) return;
        
        // Hide overlay container
        this.modal.style.display = 'none';

        // Strip drawing listeners away so they aren't leaking events processing in the background
        this.cropCanvas.removeEventListener('mousedown', this.boundMouseDown);
        this.cropCanvas.removeEventListener('mousemove', this.boundMouseMove);
        window.removeEventListener('mouseup', this.boundMouseUp);
        
        console.log("Crop Workspace Discarded.");
    },

    getMousePos(e) {
        const rect = this.cropCanvas.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) / rect.width) * this.cropCanvas.width,
            y: ((e.clientY - rect.top) / rect.height) * this.cropCanvas.height
        };
    },

    onMouseDown(e) {
        this.isDrawing = true;
        const pos = this.getMousePos(e);
        this.startX = pos.x;
        this.startY = pos.y;
        this.currentX = pos.x;
        this.currentY = pos.y;
    },

    onMouseMove(e) {
        if (!this.isDrawing) return;
        
        const pos = this.getMousePos(e);
        this.currentX = pos.x;
        this.currentY = pos.y;

        // Restore clean backup snapshot to clear previous overlay boxes
        this.cropCtx.putImageData(this.backupImageData, 0, 0);

        // Create dark outer frame matte overlay tint
        this.cropCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        this.cropCtx.fillRect(0, 0, this.cropCanvas.width, this.cropCanvas.height);

        // Normalize coordinates on-the-fly to ensure values remain positive regardless of drag direction
        const renderX = Math.min(this.startX, this.currentX);
        const renderY = Math.min(this.startY, this.currentY);
        const renderWidth = Math.abs(this.currentX - this.startX);
        const renderHeight = Math.abs(this.currentY - this.startY);
        
        // Clear transparency window for inside selection target focus zone
        this.cropCtx.save();
        this.cropCtx.globalCompositeOperation = 'destination-out';
        this.cropCtx.fillRect(renderX, renderY, renderWidth, renderHeight);
        this.cropCtx.restore();

        // Draw explicit bright white crop boundary line layout guide box rules
        this.cropCtx.strokeStyle = '#ffffff';
        this.cropCtx.lineWidth = 2;
        this.cropCtx.setLineDash([6, 4]);
        this.cropCtx.strokeRect(renderX, renderY, renderWidth, renderHeight);
    },

    onMouseUp(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        // Final normalization of interactive boundary geometry coordinates
        const x = Math.min(this.startX, this.currentX);
        const y = Math.min(this.startY, this.currentY);
        const width = Math.abs(this.currentX - this.startX);
        const height = Math.abs(this.currentY - this.startY);

        // If the box selection drag area size is valid, log the region parameters
        if (width > 15 && height > 15) {
            this.cropBox = { x, y, width, height };
        } else {
            // Revert view canvas context visuals if click was an accident/too tiny
            this.cropCtx.putImageData(this.backupImageData, 0, 0);
            this.cropBox = { x: 0, y: 0, width: 0, height: 0 };
        }
    },

executeCrop() {
        const { x, y, width, height } = this.cropBox;

        // Prevent execution on accidental tiny or invalid clicks
        if (width <= 15 || height <= 15) {
            console.warn("No valid crop area selected.");
            return;
        }

        if (!window.imgState || !window.imgState.img) return;

        // 1. Get the real working source image (the actual pixel asset before filters)
        const srcImg = window.imgState.img;

        // 2. Calculate the scaling ratio between the modal canvas and the real source image
        const scaleX = srcImg.width / this.cropCanvas.width;
        const scaleY = srcImg.height / this.cropCanvas.height;

        // 3. Map modal crop coordinates back to real, absolute source image pixels
        const realX = x * scaleX;
        const realY = y * scaleY;
        const realWidth = width * scaleX;
        const realHeight = height * scaleY;

        // 4. Create an isolated offscreen buffer to perform the actual pixel slice extraction
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = realWidth;
        sliceCanvas.height = realHeight;
        const sliceCtx = sliceCanvas.getContext('2d');

        // Extract the selected bounding box from the original image asset
        sliceCtx.drawImage(
            srcImg,
            realX, realY, realWidth, realHeight, // Source box coordinates
            0, 0, realWidth, realHeight          // Target canvas placement
        );

        // 5. Convert the canvas slice back into an Image Element asset
        const croppedImageElement = new Image();
        croppedImageElement.onload = () => {
            const finalW = croppedImageElement.width;
            const finalH = croppedImageElement.height;

            // Update core state engine references
            window.imgState.img = croppedImageElement;

            // Safely map raw source pixels to a fresh scaled viewport box layout
            if (window.CanvasEditor && typeof window.CanvasEditor.resetStateForCroppedImage === 'function') {
                window.CanvasEditor.resetStateForCroppedImage(finalW, finalH);
            }

            // Resize the offscreen image adjustments buffer framework layers
            if (window.imgState.imageXCanvas) {
                window.imgState.imageXCanvas.width = finalW;
                window.imgState.imageXCanvas.height = finalH;
            }

            // Flush out old tracking snapshots that belonged to the pre-cropped dimensions
            if (window.HistoryManager) {
                window.HistoryManager.clearToDefaultStates();
            }

            // Dispatch global event notification cascade to execute effects and repaint
            window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
        };

        // Convert slice pixels into a source image data link to trigger load callback mechanics
        croppedImageElement.src = sliceCanvas.toDataURL();

        // Close out modal interface overlay workspace smoothly
        this.closeModal();
    }
};

// Fire up core modules once DOM rendering completes
document.addEventListener("DOMContentLoaded", () => {
    CropTool.init('editorCanvas'); // Matches your main workspace canvas ID
});
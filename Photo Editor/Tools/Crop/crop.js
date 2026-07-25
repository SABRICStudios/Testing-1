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
    // Mobile Touch Bindings
    boundTouchStart: null,
    boundTouchMove: null,
    boundTouchEnd: null,

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
        
        // Bind touch counterparts
        this.boundTouchStart = this.onTouchStart.bind(this);
        this.boundTouchMove = this.onTouchMove.bind(this);
        this.boundTouchEnd = this.onTouchEnd.bind(this);

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

        // 1. Fetch the active layer instead of forcing global imgState
        const activeLayer = window.LayerManager && typeof window.LayerManager.getActiveLayer === 'function' 
            ? window.LayerManager.getActiveLayer() 
            : null;

        if (!activeLayer || !activeLayer.canvas) {
            console.warn("No active layer selected to crop.");
            return;
        }

        console.log(`Opening Crop Workspace for layer: ${activeLayer.name}`);
        
        // 2. Set modal crop canvas dimensions to match the active layer's current canvas size
        this.cropCanvas.width = activeLayer.canvas.width;
        this.cropCanvas.height = activeLayer.canvas.height;

        // 3. Draw ONLY the active layer's canvas into the crop workspace
        this.cropCtx.clearRect(0, 0, this.cropCanvas.width, this.cropCanvas.height);
        this.cropCtx.drawImage(activeLayer.canvas, 0, 0);

        // 4. Cache clean base snapshot of the selected layer
        this.backupImageData = this.cropCtx.getImageData(0, 0, this.cropCanvas.width, this.cropCanvas.height);

        // Reset default cropping bounding metrics
        this.cropBox = { x: 0, y: 0, width: 0, height: 0 };
        this.cropCanvas.style.cursor = 'crosshair';

        // 5. Reveal workspace modal layout
        this.modal.style.display = 'flex';

        // 6. Mount mouse input listeners
        this.cropCanvas.addEventListener('mousedown', this.boundMouseDown);
        this.cropCanvas.addEventListener('mousemove', this.boundMouseMove);
        window.addEventListener('mouseup', this.boundMouseUp);

        // 7. Mount touch input listeners
        this.cropCanvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
        this.cropCanvas.addEventListener('touchmove', this.boundTouchMove, { passive: false });
        window.addEventListener('touchend', this.boundTouchEnd);
    },

    closeModal() {
        if (!this.modal) return;
        
        // Hide overlay container
        this.modal.style.display = 'none';

        // Strip drawing listeners
        this.cropCanvas.removeEventListener('mousedown', this.boundMouseDown);
        this.cropCanvas.removeEventListener('mousemove', this.boundMouseMove);
        window.removeEventListener('mouseup', this.boundMouseUp);

        // Strip touch listeners
        this.cropCanvas.removeEventListener('touchstart', this.boundTouchStart);
        this.cropCanvas.removeEventListener('touchmove', this.boundTouchMove);
        window.removeEventListener('touchend', this.boundTouchEnd);
        
        console.log("Crop Workspace Discarded.");
    },

    getMousePos(e) {
        const rect = this.cropCanvas.getBoundingClientRect();
        
        let clientX = e.clientX;
        let clientY = e.clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            clientX = e.changedTouches[0].clientX;
            clientY = e.changedTouches[0].clientY;
        }

        return {
            x: ((clientX - rect.left) / rect.width) * this.cropCanvas.width,
            y: ((clientY - rect.top) / rect.height) * this.cropCanvas.height
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

        // Restore clean backup snapshot
        this.cropCtx.putImageData(this.backupImageData, 0, 0);

        // Dark outer frame matte overlay
        this.cropCtx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        this.cropCtx.fillRect(0, 0, this.cropCanvas.width, this.cropCanvas.height);

        // Normalize coordinates
        const renderX = Math.min(this.startX, this.currentX);
        const renderY = Math.min(this.startY, this.currentY);
        const renderWidth = Math.abs(this.currentX - this.startX);
        const renderHeight = Math.abs(this.currentY - this.startY);
        
        // Clear selection target area
        this.cropCtx.save();
        this.cropCtx.globalCompositeOperation = 'destination-out';
        this.cropCtx.fillRect(renderX, renderY, renderWidth, renderHeight);
        this.cropCtx.restore();

        // White border line overlay
        this.cropCtx.strokeStyle = '#ffffff';
        this.cropCtx.lineWidth = 2;
        this.cropCtx.setLineDash([6, 4]);
        this.cropCtx.strokeRect(renderX, renderY, renderWidth, renderHeight);
    },

    onMouseUp(e) {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        const x = Math.min(this.startX, this.currentX);
        const y = Math.min(this.startY, this.currentY);
        const width = Math.abs(this.currentX - this.startX);
        const height = Math.abs(this.currentY - this.startY);

        if (width > 15 && height > 15) {
            this.cropBox = { x, y, width, height };
        } else {
            this.cropCtx.putImageData(this.backupImageData, 0, 0);
            this.cropBox = { x: 0, y: 0, width: 0, height: 0 };
        }
    },

    // Mobile Bridge Handlers
    onTouchStart(e) {
        e.preventDefault();
        this.onMouseDown(e);
    },

    onTouchMove(e) {
        e.preventDefault();
        this.onMouseMove(e);
    },

    onTouchEnd(e) {
        this.onMouseUp(e);
    },

    executeCrop() {
        const { x, y, width, height } = this.cropBox;

        if (width <= 15 || height <= 15) {
            console.warn("No valid crop area selected.");
            return;
        }

        // 1. Identify current active target layer
        const activeLayer = window.LayerManager && typeof window.LayerManager.getActiveLayer === 'function'
            ? window.LayerManager.getActiveLayer()
            : null;

        if (!activeLayer) return;

        // Determine source image/canvas context for this layer
        const sourceAsset = activeLayer.sourceImage || activeLayer.originalCanvas || activeLayer.canvas;
        if (!sourceAsset) return;

        // 2. Map coordinates relative to the underlying source asset
        const scaleX = (sourceAsset.naturalWidth || sourceAsset.width) / this.cropCanvas.width;
        const scaleY = (sourceAsset.naturalHeight || sourceAsset.height) / this.cropCanvas.height;

        const realX = Math.round(x * scaleX);
        const realY = Math.round(y * scaleY);
        const realWidth = Math.round(width * scaleX);
        const realHeight = Math.round(height * scaleY);

        // 3. Perform pixel slice on offscreen buffer
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = realWidth;
        sliceCanvas.height = realHeight;
        const sliceCtx = sliceCanvas.getContext('2d');

        sliceCtx.drawImage(
            sourceAsset,
            realX, realY, realWidth, realHeight,
            0, 0, realWidth, realHeight
        );

        // 4. Update the active layer canvas assets
        const croppedImageElement = new Image();
        croppedImageElement.onload = () => {
            // Update active layer properties
            activeLayer.canvas.width = realWidth;
            activeLayer.canvas.height = realHeight;

            // Re-render layer canvas
            const lCtx = activeLayer.canvas.getContext('2d');
            lCtx.clearRect(0, 0, realWidth, realHeight);
            lCtx.drawImage(croppedImageElement, 0, 0);

            // Update layer backups & state
            if (activeLayer.originalCanvas) {
                activeLayer.originalCanvas.width = realWidth;
                activeLayer.originalCanvas.height = realHeight;
                activeLayer.originalCanvas.getContext('2d').drawImage(croppedImageElement, 0, 0);
            }
            activeLayer.sourceImage = croppedImageElement;
            activeLayer.width = realWidth;
            activeLayer.height = realHeight;

            // Shift layer position relative to canvas display
            activeLayer.x = (activeLayer.x || 0) + (x * (window.imgState.width / this.cropCanvas.width));
            activeLayer.y = (activeLayer.y || 0) + (y * (window.imgState.height / this.cropCanvas.height));

            // Sync global state if active layer is the Background layer (ID 1)
            if (activeLayer.id === 1) {
                window.imgState.img = croppedImageElement;
                window.imgState.width = realWidth;
                window.imgState.height = realHeight;
                if (window.imgState.imageXCanvas) {
                    window.imgState.imageXCanvas.width = realWidth;
                    window.imgState.imageXCanvas.height = realHeight;
                }
            } else if (activeLayer.id === window.LayerManager.activeLayerId) {
                window.imgState.width = realWidth;
                window.imgState.height = realHeight;
            }

            // Trigger global composite recalculation
            if (window.CanvasEditor && typeof window.CanvasEditor.applyEffectsPipeline === 'function') {
                window.CanvasEditor.applyEffectsPipeline();
            } else {
                window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
            }
        };

        croppedImageElement.src = sliceCanvas.toDataURL();

        // 5. Commit crop state record to History stack
        if (window.HistoryManager && typeof window.HistoryManager.commitCropAction === 'function') {
            window.HistoryManager.commitCropAction(`Crop ${activeLayer.name}`, {
                x: x / this.cropCanvas.width,
                y: y / this.cropCanvas.height,
                width: width / this.cropCanvas.width,
                height: height / this.cropCanvas.height
            });
        }

        // Close modal workspace
        this.closeModal();
    }
};

// Initialize modules on DOM load
document.addEventListener("DOMContentLoaded", () => {
    CropTool.init('editorCanvas');
});
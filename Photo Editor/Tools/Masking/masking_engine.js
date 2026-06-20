/**
 * Visuals Photo Editor - Masking Engine
 * Manages offscreen alpha buffers, painting states, and canvas composition logic.
 */

const MaskingEngine = {
    isActive: false,
    currentType: 'brush', // brush, linear, radial, auto
    isDrawing: false,
    
    // Core canvas resources
    mainCanvas: null,
    mainCtx: null,
    maskCanvas: null, // Offscreen alpha tracker matrix
    maskCtx: null,
    backupCanvas: null, // Safe rollback check-point

    // Dynamic Parameter Metrics
    settings: {
        brushSize: 40,
        brushFeather: 0.5,
        brushMode: 'add', // 'add' (white) | 'subtract' (black)
        gradientFeather: 100,
        tolerance: 32,
        globalOpacity: 1.0
    },

    // Point coordinates tracking vectors
    gradientStart: { x: 0, y: 0 },

    activate: function() {
        this.mainCanvas = document.getElementById('editorCanvas');
        if (!this.mainCanvas) return;
        this.mainCtx = this.mainCanvas.getContext('2d');

        this.isActive = true;

        // Create canvas snapshots for non-destructive operations
        this.backupCanvas = document.createElement('canvas');
        this.backupCanvas.width = this.mainCanvas.width;
        this.backupCanvas.height = this.mainCanvas.height;
        this.backupCanvas.getContext('2d').drawImage(this.mainCanvas, 0, 0);

        // Build mask matrix overlay canvas (Starts filled with fully revealed white)
        this.maskCanvas = document.createElement('canvas');
        this.maskCanvas.width = this.mainCanvas.width;
        this.maskCanvas.height = this.mainCanvas.height;
        this.maskCtx = this.maskCanvas.getContext('2d');
        
        this.clearMask(true); // Default to full white background snapshot

        this.attachInteractions();
        this.redraw();
    },

    clearMask: function(revealAll) {
        this.maskCtx.fillStyle = revealAll ? '#ffffff' : '#000000';
        this.maskCtx.fillRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
    },

    setMaskType: function(type) {
        this.currentType = type;
        this.redraw();
    },

    attachInteractions: function() {
        this.mainCanvas.addEventListener('mousedown', this.onStart.bind(this));
        this.mainCanvas.addEventListener('mousemove', this.onMove.bind(this));
        window.addEventListener('mouseup', this.onEnd.bind(this));
    },

    getCanvasCoordinates: function(e) {
        const rect = this.mainCanvas.getBoundingClientRect();
        // Translate view scale mappings smoothly
        return {
            x: ((e.clientX - rect.left) / rect.width) * this.mainCanvas.width,
            y: ((e.clientY - rect.top) / rect.height) * this.mainCanvas.height
        };
    },

    onStart: function(e) {
        if (!this.isActive) return;
        this.isDrawing = true;
        const coords = this.getCanvasCoordinates(e);

        if (this.currentType === 'brush') {
            this.drawBrushStroke(coords.x, coords.y);
        } else if (this.currentType === 'linear' || this.currentType === 'radial') {
            this.gradientStart = coords;
            this.clearMask(false); // Clear to black to prepare for gradient fill
        }
    },

    onMove: function(e) {
        if (!this.isActive || !this.isDrawing) return;
        const coords = this.getCanvasCoordinates(e);

        if (this.currentType === 'brush') {
            this.drawBrushStroke(coords.x, coords.y);
        } else if (this.currentType === 'linear' || this.currentType === 'radial') {
            this.drawGradientShape(coords.x, coords.y);
        }
    },

    onEnd: function() {
        if (!this.isActive) return;
        this.isDrawing = false;
    },

    drawBrushStroke: function(x, y) {
        this.maskCtx.save();
        
        // Setup Feathered Profile via radial path gradients
        const gradient = this.maskCtx.createRadialGradient(x, y, this.settings.brushSize * (1 - this.settings.brushFeather), x, y, this.settings.brushSize);
        
        if (this.settings.brushMode === 'add') {
            gradient.addColorStop(0, 'rgba(255,255,255,1)');
            gradient.addColorStop(1, 'rgba(255,255,255,0)');
        } else {
            gradient.addColorStop(0, 'rgba(0,0,0,1)');
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
        }

        // Apply compositing rules depending on brush behavior
        this.maskCtx.globalCompositeOperation = this.settings.brushMode === 'add' ? 'source-over' : 'destination-out';
        this.maskCtx.fillStyle = gradient;
        
        this.maskCtx.beginPath();
        this.maskCtx.arc(x, y, this.settings.brushSize, 0, Math.PI * 2);
        this.maskCtx.fill();
        this.maskCtx.restore();

        this.redraw();
    },

    drawGradientShape: function(currentX, currentY) {
        this.clearMask(false); // Reset matrix to black
        this.maskCtx.save();

        if (this.currentType === 'linear') {
            const grad = this.maskCtx.createLinearGradient(this.gradientStart.x, this.gradientStart.y, currentX, currentY);
            grad.addColorStop(0, 'rgba(255,255,255,1)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            this.maskCtx.fillStyle = grad;
            this.maskCtx.fillRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
        } else if (this.currentType === 'radial') {
            const dx = currentX - this.gradientStart.x;
            const dy = currentY - this.gradientStart.y;
            const radius = Math.sqrt(dx * dx + dy * dy);

            const grad = this.maskCtx.createRadialGradient(this.gradientStart.x, this.gradientStart.y, 0, this.gradientStart.x, this.gradientStart.y, radius);
            grad.addColorStop(0, 'rgba(255,255,255,1)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            this.maskCtx.fillStyle = grad;
            this.maskCtx.fillRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
        }

        this.maskCtx.restore();
        this.redraw();
    },

    invertMask: function() {
        if (!this.isActive) return;
        
        // Invert mask pixels using a temporary composition layer
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.maskCanvas.width;
        tempCanvas.height = this.maskCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tempCtx.globalCompositeOperation = 'difference';
        tempCtx.drawImage(this.maskCanvas, 0, 0);
        
        this.clearMask(true);
        this.maskCtx.drawImage(tempCanvas, 0, 0);
        
        this.redraw();
    },

    redraw: function() {
        if (!this.isActive) return;

        // 1. Reset canvas frame back to base backup image data
        this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
        this.mainCtx.drawImage(this.backupCanvas, 0, 0);

        // 2. Mix mask alpha calculations with master image via Source-In composite strategy
        this.mainCtx.save();
        this.mainCtx.globalAlpha = this.settings.globalOpacity;
        this.mainCtx.globalCompositeOperation = 'destination-in';
        this.mainCtx.drawImage(this.maskCanvas, 0, 0);
        this.mainCtx.restore();
    },

    deactivate: function(applyChanges) {
        this.isActive = false;
        
        if (!applyChanges) {
            // Restore previous raw source snapshot if cancelled
            this.mainCtx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
            this.mainCtx.drawImage(this.backupCanvas, 0, 0);
        } else {
            // Commit masking layer state onto standard historical image stack
            if (window.LayerManager && typeof LayerManager.saveState === 'function') {
                LayerManager.saveState();
            }
        }

        // Garbage collection references cleanups
        this.maskCanvas = null;
        this.maskCtx = null;
        this.backupCanvas = null;
    }
};
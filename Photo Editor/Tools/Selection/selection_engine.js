// selection_editor.js - Modern Selection Tool Engine Architecture
(function () {
    window.SelectionEditor = {
        isOpen: false,
        activeMode: 'rect', // 'rect', 'ellipse', 'lasso', 'wand', 'subject'
        wandTolerance: 32,
        isDrawing: false,
        startCoords: { x: 0, y: 0 },
        currentCoords: { x: 0, y: 0 },
        lassoPoints: [],

        

        // Canvas & Context references
        overlayCanvas: null,
        overlayCtx: null,

        init: function () {
            this.createOverlayCanvas();
            this.bindEvents();
        },

        createOverlayCanvas: function () {
            let canvas = document.getElementById('selectionOverlayCanvas');
            if (!canvas) {
                canvas = document.createElement('canvas');
                canvas.id = 'selectionOverlayCanvas';
                canvas.style.position = 'absolute';
                canvas.style.top = '0';
                canvas.style.left = '0';
                canvas.style.pointerEvents = 'none';
                canvas.style.zIndex = '100';

                const editorCanvas = document.getElementById('editorCanvas');
                if (editorCanvas && editorCanvas.parentNode) {
                    editorCanvas.parentNode.appendChild(canvas);
                }
            }
            this.overlayCanvas = canvas;
            this.overlayCtx = canvas.getContext('2d');
            this.syncOverlaySize();
        },

        syncOverlaySize: function () {
            const mainCanvas = document.getElementById('editorCanvas');
            if (mainCanvas && this.overlayCanvas) {
                this.overlayCanvas.width = mainCanvas.width;
                this.overlayCanvas.height = mainCanvas.height;
                this.overlayCanvas.style.width = mainCanvas.style.width || `${mainCanvas.width}px`;
                this.overlayCanvas.style.height = mainCanvas.style.height || `${mainCanvas.height}px`;
            }
        },

        setMode: function (mode) {
            this.activeMode = mode;
            this.resetDrawingState();
            this.drawOverlay();
        },

        getCanvasCoordinates: function (e) {
            const canvas = document.getElementById('editorCanvas');
            if (!canvas) return { x: 0, y: 0 };
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            return {
                x: Math.round((e.clientX - rect.left) * scaleX),
                y: Math.round((e.clientY - rect.top) * scaleY)
            };
        },

        handlePointerDown: function (e) {
            if (!this.isOpen) return;

            const coords = this.getCanvasCoordinates(e);
            this.startCoords = coords;
            this.currentCoords = coords;
            this.isDrawing = true;

            if (this.activeMode === 'lasso') {
                this.lassoPoints = [coords];
            } else if (this.activeMode === 'wand') {
                this.processColorSelection(coords.x, coords.y);
                this.isDrawing = false;
            } else if (this.activeMode === 'subject') {
                this.processSubjectSelection(coords.x, coords.y);
                this.isDrawing = false;
            }
            
            this.drawOverlay();
        },

        handlePointerMove: function (e) {
            if (!this.isOpen || !this.isDrawing) return;

            const coords = this.getCanvasCoordinates(e);
            this.currentCoords = coords;

            if (this.activeMode === 'lasso') {
                this.lassoPoints.push(coords);
            }

            this.drawOverlay();
        },

        handlePointerUp: function () {
            if (!this.isOpen || !this.isDrawing) return;
            this.isDrawing = false;

            this.finalizeSelectionArea();
            this.drawOverlay();
        },

        processColorSelection: function (startX, startY) {
            const mainCanvas = document.getElementById('editorCanvas');
            if (!mainCanvas) return;
            const ctx = mainCanvas.getContext('2d');
            const imgData = ctx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
            
            const mask = new Uint8ClampedArray(mainCanvas.width * mainCanvas.height * 4);
            const targetIdx = (startY * mainCanvas.width + startX) * 4;
            const targetR = imgData.data[targetIdx];
            const targetG = imgData.data[targetIdx + 1];
            const targetB = imgData.data[targetIdx + 2];

            const tolerance = this.wandTolerance;
            
            for (let i = 0; i < imgData.data.length; i += 4) {
                const r = imgData.data[i];
                const g = imgData.data[i + 1];
                const b = imgData.data[i + 2];

                const diff = Math.abs(r - targetR) + Math.abs(g - targetG) + Math.abs(b - targetB);
                if (diff <= tolerance * 3) {
                    mask[i + 3] = 255;
                }
            }

            window.activeSelectionMask = {
                width: mainCanvas.width,
                height: mainCanvas.height,
                data: mask
            };
            
            this.notifyStateChange();
        },

        processSubjectSelection: function (seedX, seedY) {
            const mainCanvas = document.getElementById('editorCanvas');
            if (!mainCanvas) return;
            const ctx = mainCanvas.getContext('2d');
            const imgData = ctx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
            const mask = new Uint8ClampedArray(mainCanvas.width * mainCanvas.height * 4);

            const startX = seedX !== undefined ? seedX : Math.floor(mainCanvas.width / 2);
            const startY = seedY !== undefined ? seedY : Math.floor(mainCanvas.height / 2);

            const targetIdx = (startY * mainCanvas.width + startX) * 4;
            const refR = imgData.data[targetIdx];
            const refG = imgData.data[targetIdx + 1];
            const refB = imgData.data[targetIdx + 2];

            for (let i = 0; i < imgData.data.length; i += 4) {
                const dist = Math.sqrt(
                    Math.pow(imgData.data[i] - refR, 2) +
                    Math.pow(imgData.data[i + 1] - refG, 2) +
                    Math.pow(imgData.data[i + 2] - refB, 2)
                );
                if (dist < 80) {
                    mask[i + 3] = 255;
                }
            }

            window.activeSelectionMask = {
                width: mainCanvas.width,
                height: mainCanvas.height,
                data: mask
            };

            this.notifyStateChange();
        },

finalizeSelectionArea: function () {
    const mainCanvas = document.getElementById('editorCanvas');
    if (!mainCanvas) return;

    const targetCanvas = window.LayerManager?.getActiveLayer()?.canvas || window.imgState?.imageXCanvas || mainCanvas;
    const maskWidth = targetCanvas.width;
    const maskHeight = targetCanvas.height;

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = maskWidth;
    maskCanvas.height = maskHeight;
    const maskCtx = maskCanvas.getContext('2d');

    maskCtx.fillStyle = 'rgba(255, 255, 255, 1.0)';

    const scaleX = maskWidth / mainCanvas.width;
    const scaleY = maskHeight / mainCanvas.height;

    const startX = this.startCoords.x * scaleX;
    const startY = this.startCoords.y * scaleY;
    const curX = this.currentCoords.x * scaleX;
    const curY = this.currentCoords.y * scaleY;

    if (this.activeMode === 'rect') {
        maskCtx.fillRect(startX, startY, curX - startX, curY - startY);
    } else if (this.activeMode === 'ellipse') {
        maskCtx.beginPath();
        const rx = Math.abs(curX - startX) / 2;
        const ry = Math.abs(curY - startY) / 2;
        const cx = Math.min(startX, curX) + rx;
        const cy = Math.min(startY, curY) + ry;
        maskCtx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        maskCtx.fill();
    } else if ((this.activeMode === 'lasso' || this.activeMode === 'poly') && this.lassoPoints.length > 2) {
        maskCtx.beginPath();
        maskCtx.moveTo(this.lassoPoints[0].x * scaleX, this.lassoPoints[0].y * scaleY);
        for (let i = 1; i < this.lassoPoints.length; i++) {
            maskCtx.lineTo(this.lassoPoints[i].x * scaleX, this.lassoPoints[i].y * scaleY);
        }
        maskCtx.closePath();
        maskCtx.fill();
    }

    const maskImgData = maskCtx.getImageData(0, 0, maskWidth, maskHeight);

    // Calculate tight bounding box
    let minX = maskWidth, minY = maskHeight, maxX = 0, maxY = 0;

    if (this.activeMode === 'lasso' || this.activeMode === 'poly') {
        for (const pt of this.lassoPoints) {
            const px = pt.x * scaleX;
            const py = pt.y * scaleY;
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
        }
    } else {
        minX = Math.min(startX, curX);
        maxX = Math.max(startX, curX);
        minY = Math.min(startY, curY);
        maxY = Math.max(startY, curY);
    }

    minX = Math.max(0, Math.floor(minX));
    minY = Math.max(0, Math.floor(minY));
    maxX = Math.min(maskWidth, Math.ceil(maxX));
    maxY = Math.min(maskHeight, Math.ceil(maxY));

    // Assign actual mask pixel data and calculated bounds
    window.activeSelectionMask = {
        width: maskWidth,
        height: maskHeight,
        data: maskImgData.data,
        bounds: {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        }
    };

    this.isOpen = true;
    this.notifyStateChange();
},
        drawOverlay: function () {
            if (!this.overlayCtx) return;
            this.syncOverlaySize();
            this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

            if (!this.isOpen) return;

            this.overlayCtx.strokeStyle = '#00e5ff';
            this.overlayCtx.lineWidth = 1.5;
            this.overlayCtx.setLineDash([6, 4]);

            const startX = this.startCoords.x;
            const startY = this.startCoords.y;
            const curX = this.currentCoords.x;
            const curY = this.currentCoords.y;

            if (this.isDrawing) {
                if (this.activeMode === 'rect') {
                    this.overlayCtx.strokeRect(startX, startY, curX - startX, curY - startY);
                } else if (this.activeMode === 'ellipse') {
                    this.overlayCtx.beginPath();
                    const rx = Math.abs(curX - startX) / 2;
                    const ry = Math.abs(curY - startY) / 2;
                    const cx = Math.min(startX, curX) + rx;
                    const cy = Math.min(startY, curY) + ry;
                    this.overlayCtx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
                    this.overlayCtx.stroke();
                } else if (this.activeMode === 'lasso' && this.lassoPoints.length > 0) {
                    this.overlayCtx.beginPath();
                    this.overlayCtx.moveTo(this.lassoPoints[0].x, this.lassoPoints[0].y);
                    for (let i = 1; i < this.lassoPoints.length; i++) {
                        this.overlayCtx.lineTo(this.lassoPoints[i].x, this.lassoPoints[i].y);
                    }
                    this.overlayCtx.stroke();
                }
            }
        },

        resetDrawingState: function () {
            this.isDrawing = false;
            this.lassoPoints = [];
            this.startCoords = { x: 0, y: 0 };
            this.currentCoords = { x: 0, y: 0 };
        },

        clearSelection: function() {
            if (window.imgState && window.imgState.selection) {
                window.imgState.selection.active = false;
                window.imgState.selection.bounds = null;
                window.imgState.selection.path = [];
            }
            this.isSelecting = false;

            if (window.SelectionEditor) {
                window.SelectionEditor.clearSelection();
            } else {
                window.activeSelectionMask = null;
                if (window.CanvasEditor && typeof window.CanvasEditor.applyEffectsPipeline === 'function') {
                    window.CanvasEditor.applyEffectsPipeline();
                }
            }
        },

        notifyStateChange: function() {
            if (window.SelectionManager) {
                window.SelectionManager.syncFromEngine();
            }
            if (window.CanvasEditor && typeof window.CanvasEditor.applyEffectsPipeline === 'function') {
                window.CanvasEditor.applyEffectsPipeline();
            }
        },

        bindEvents: function () {
            const canvas = document.getElementById('editorCanvas');
            if (!canvas) return;

            canvas.addEventListener('mousedown', (e) => this.handlePointerDown(e));
            window.addEventListener('mousemove', (e) => this.handlePointerMove(e));
            window.addEventListener('mouseup', () => this.handlePointerUp());
            window.addEventListener('resize', () => this.syncOverlaySize());
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        window.SelectionEditor.init();
    });
})();
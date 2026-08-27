// selection_engine_unified.js
(function () {
'use strict';

const DEFAULTS = {
    mode: 'rect',
    operation: 'new',
    wandTolerance: 32,
    brushRadius: 20,
    feather: 0,
    colorTolerance: 32
};

const MODES = ['rect', 'ellipse', 'lasso', 'poly', 'wand', 'brush', 'subject', 'eyedropper'];


window.selectionProcessingActive = false;
window.selectionDisplayMask = null;
window.SelectionEditor = {
    isOpen: false,
    activeMode: DEFAULTS.mode,
    operation: DEFAULTS.operation,
    wandTolerance: DEFAULTS.wandTolerance,
    brushRadius: DEFAULTS.brushRadius,
    feather: DEFAULTS.feather,
    colorTolerance: DEFAULTS.colorTolerance,
    isDrawing: false,
    startCoords: {x: 0, y: 0},
    currentCoords: {x: 0, y: 0},
    lassoPoints: [],
    polygonPoints: [],
    overlayCanvas: null,
    overlayCtx: null,
    currentMask: null,
    previewMask: null,
    brushLastPoint: null,
    _eventsBound: false,
    _uiBound: false,

    init: function () {
        this.createOverlayCanvas();
        this.bindEvents();
        this.bindUIButtons();
        this.syncControls();
        this.setToolActive(false);
        this.drawOverlay();
    },

    createOverlayCanvas: function () {
        let canvas = document.getElementById('selectionOverlayCanvas');
        const main = document.getElementById('editorCanvas');
        if (!main) return;

        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'selectionOverlayCanvas';
            canvas.style.position = 'absolute';
            canvas.style.pointerEvents = 'none';
            canvas.style.zIndex = '1';

            const parent = main.parentElement;
            if (parent) {
                const ps = getComputedStyle(parent);
                if (ps.position === 'static') parent.style.position = 'relative';
                parent.appendChild(canvas);
            }
        }

        this.overlayCanvas = canvas;
        this.overlayCtx = canvas.getContext('2d');
        this.syncOverlaySize();
    },

    syncOverlaySize: function () {
        const main = document.getElementById('editorCanvas');
        const overlay = this.overlayCanvas;
        if (!main || !overlay) return;

        overlay.width = main.width;
        overlay.height = main.height;

        const r = main.getBoundingClientRect();
        const p = main.parentElement;
        if (!p) return;

        const pr = p.getBoundingClientRect();
        overlay.style.left = `${r.left - pr.left}px`;
        overlay.style.top = `${r.top - pr.top}px`;
        overlay.style.width = `${r.width}px`;
        overlay.style.height = `${r.height}px`;
    },

    getActiveLayer: function () {
        if (window.LayerManager && typeof window.LayerManager.getActiveLayer === 'function') {
            return window.LayerManager.getActiveLayer();
        }
        return null;
    },

    getTargetCanvas: function () {
        const layer = this.getActiveLayer();
        if (layer && layer.canvas) return layer.canvas;
        if (window.imgState && window.imgState.imageXCanvas) return window.imgState.imageXCanvas;
        return document.getElementById('editorCanvas');
    },

    getImageRect: function () {
        const main = document.getElementById('editorCanvas');
        if (!main) return null;

        const layer = this.getActiveLayer();
        const s = window.imgState || {};

        let x = Number(s.x);
        let y = Number(s.y);
        let width = Number(s.width);
        let height = Number(s.height);

        if (!(width > 0 && height > 0) && layer) {
            x = Number(layer.x);
            y = Number(layer.y);
            width = Number(layer.displayWidth || layer.width);
            height = Number(layer.displayHeight || layer.height);
        }

        if (!(width > 0 && height > 0)) {
            const target = this.getTargetCanvas();
            width = target ? target.width : main.width;
            height = target ? target.height : main.height;
            x = 0;
            y = 0;
        }

        return {
            x: Number.isFinite(x) ? x : 0,
            y: Number.isFinite(y) ? y : 0,
            width,
            height,
            rotation: Number(s.rotation) || 0
        };
    },

    getWorkingDimensions: function () {
        const target = this.getTargetCanvas();
        if (!target) return null;
        return {width: target.width, height: target.height};
    },

    getDisplayToMaskScale: function () {
        const target = this.getTargetCanvas();
        const rect = this.getImageRect();
        if (!target || !rect) return {x: 1, y: 1};
        return {
            x: target.width / Math.max(1, rect.width),
            y: target.height / Math.max(1, rect.height)
        };
    },

    displayToMask: function (point) {
        const target = this.getTargetCanvas();
        const rect = this.getImageRect();
        if (!target || !rect) return {x: point.x, y: point.y};

        let x = point.x - rect.x;
        let y = point.y - rect.y;

        if (rect.rotation) {
            const a = -rect.rotation * Math.PI / 180;
            const cx = rect.width / 2;
            const cy = rect.height / 2;
            const dx = x - cx;
            const dy = y - cy;
            const c = Math.cos(a);
            const s = Math.sin(a);
            x = dx * c - dy * s + cx;
            y = dx * s + dy * c + cy;
        }

        return {
            x: x * target.width / Math.max(1, rect.width),
            y: y * target.height / Math.max(1, rect.height)
        };
    },

    maskToDisplay: function (point) {
        const target = this.getTargetCanvas();
        const rect = this.getImageRect();
        if (!target || !rect) return {x: point.x, y: point.y};

        let x = point.x * rect.width / Math.max(1, target.width);
        let y = point.y * rect.height / Math.max(1, target.height);

        if (rect.rotation) {
            const a = rect.rotation * Math.PI / 180;
            const cx = rect.width / 2;
            const cy = rect.height / 2;
            const dx = x - cx;
            const dy = y - cy;
            const c = Math.cos(a);
            const s = Math.sin(a);
            x = dx * c - dy * s + cx;
            y = dx * s + dy * c + cy;
        }

        return {x: rect.x + x, y: rect.y + y};
    },

    getCanvasCoordinates: function (e) {
        const canvas = document.getElementById('editorCanvas');
        if (!canvas) return {x: 0, y: 0};

        const r = canvas.getBoundingClientRect();
        const sx = canvas.width / Math.max(1, r.width);
        const sy = canvas.height / Math.max(1, r.height);

        return {
            x: Math.max(0, Math.min(canvas.width, (e.clientX - r.left) * sx)),
            y: Math.max(0, Math.min(canvas.height, (e.clientY - r.top) * sy))
        };
    },

    setToolActive: function(active) {
        this.isOpen = !!active;
        window.selectionProcessingActive = !!active;

        if (!active) {
            this.isDrawing = false;
            this.lassoPoints = [];
            this.polygonPoints = [];
            this.brushLastPoint = null;
            this.clearOverlay();
        }

        this.updateButtonStates();
        this.updateModeControls();
    },

    updateButtonStates: function () {
        document.querySelectorAll('.selection-mode-btn').forEach(btn => {
            const active = this.isOpen && btn.getAttribute('data-mode') === (this.activeMode === 'poly' ? 'polygonal' : this.activeMode);
            btn.classList.toggle('active', active);
            btn.style.borderColor = active ? '#00adb5' : '#333';
            btn.style.color = active ? '#fff' : '#aaa';
        });
    },

    bindUIButtons: function () {
        if (this._uiBound) return;
        this._uiBound = true;

        document.querySelectorAll('.selection-mode-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                const mode = btn.getAttribute('data-mode');
                if (!mode) return;
                this.activeMode = mode === 'polygonal' ? 'poly' : mode;
                this.setToolActive(true);
                window.selectionProcessingActive = true;
                this.resetDrawingState();
                this.syncToGlobalState();
                this.updateModeControls();
                this.drawOverlay();
            });
        });

        document.querySelectorAll('.op-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                const op = btn.getAttribute('data-op');
                if (!['new', 'add', 'subtract'].includes(op)) return;
                this.operation = op;
                document.querySelectorAll('.op-btn').forEach(b => {
                    const active = b === btn;
                    b.classList.toggle('active', active);
                    b.style.background = active ? '#2a2a2a' : 'transparent';
                    b.style.color = active ? '#fff' : '#888';
                });
            });
        });

        const wand = document.getElementById('wandTolerance');
        if (wand) wand.addEventListener('input', () => {
            this.wandTolerance = parseInt(wand.value, 10) || 32;
            const v = document.getElementById('wandToleranceVal');
            if (v) v.textContent = this.wandTolerance;
        });

        const brush = document.getElementById('selectionBrushSize');
        if (brush) brush.addEventListener('input', () => {
            this.brushRadius = parseInt(brush.value, 10) || 20;
            const v = document.getElementById('selectionBrushSizeVal');
            if (v) v.textContent = `${this.brushRadius}px`;
            this.drawOverlay();
        });

        const feather = document.getElementById('selectionFeather');
        if (feather) feather.addEventListener('input', () => {
            this.feather = parseInt(feather.value, 10) || 0;
            const v = document.getElementById('selectionFeatherVal');
            if (v) v.textContent = `${this.feather}px`;
            if (this.currentMask) {
                this.applyMaskToGlobal();
                this.drawOverlay();
            }
        });

        const confirm = document.getElementById('confirmSelectionBtn');
        if (confirm) confirm.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            this.confirmSelection();
        });

        const discard = document.getElementById('discardSelectionBtn');
        if (discard) discard.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            this.discardSelection();
        });

        const minimize = document.getElementById('minimizeSelectionBtn');
        if (minimize) minimize.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            this.minimizePanel();
        });

        const expand = document.getElementById('expandSelectionBtn');
        if (expand) expand.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            this.expandPanel();
        });

        const mini = document.getElementById('selectionPanelMini');
        if (mini) mini.addEventListener('click', e => {
            if (e.target.closest('#expandSelectionBtn')) {
                e.preventDefault();
                e.stopPropagation();
                this.expandPanel();
            }
        });
        },

    syncControls: function () {
        const wand = document.getElementById('wandTolerance');
        if (wand) wand.value = this.wandTolerance;

        const wandVal = document.getElementById('wandToleranceVal');
        if (wandVal) wandVal.textContent = this.wandTolerance;

        const brush = document.getElementById('selectionBrushSize');
        if (brush) brush.value = this.brushRadius;

        const brushVal = document.getElementById('selectionBrushSizeVal');
        if (brushVal) brushVal.textContent = `${this.brushRadius}px`;

        const feather = document.getElementById('selectionFeather');
        if (feather) feather.value = this.feather;

        const featherVal = document.getElementById('selectionFeatherVal');
        if (featherVal) featherVal.textContent = `${this.feather}px`;

        this.updateModeControls();
        this.updateButtonStates();
    },

    updateModeControls: function () {
        const wand = document.getElementById('wandControls');
        const brush = document.getElementById('brushSizeControls');
        if (wand) wand.style.display = this.isOpen && (this.activeMode === 'wand' || this.activeMode === 'eyedropper') ? 'block' : 'none';
        if (brush) brush.style.display = this.isOpen && this.activeMode === 'brush' ? 'block' : 'none';
    },

    bindEvents: function () {
        if (this._eventsBound) return;
        const canvas = document.getElementById('editorCanvas');
        if (!canvas) return;
        this._eventsBound = true;

        canvas.addEventListener('pointerdown', e => this.handlePointerDown(e));
        window.addEventListener('pointermove', e => this.handlePointerMove(e));
        window.addEventListener('pointerup', e => this.handlePointerUp(e));
        canvas.addEventListener('dblclick', e => this.handleDoubleClick(e));

        window.addEventListener('resize', () => {
            this.syncOverlaySize();
            this.drawOverlay();
        });
    },

    handlePointerDown: function (e) {
        if (!this.isOpen || e.button !== 0) return;

        const p = this.getCanvasCoordinates(e);
        this.currentCoords = p;

        if (this.activeMode === 'wand') {
            this.createMagicWandSelection(p);
            return;
        }

        if (this.activeMode === 'eyedropper') {
            this.createColorRangeSelection(p);
            return;
        }

        if (this.activeMode === 'subject') {
            this.createSubjectSelection(p);
            return;
        }

        if (this.activeMode === 'poly') {
            this.handlePolygonPointerDown(p);
            return;
        }

        if (this.activeMode === 'brush') {
            this.beginBrushStroke(p);
            return;
        }

        this.isDrawing = true;
        this.startCoords = {...p};
        this.currentCoords = {...p};

        if (this.activeMode === 'lasso') this.lassoPoints = [p];
        this.drawOverlay();
    },

    handlePointerMove: function (e) {
        if (!this.isOpen) return;

        const p = this.getCanvasCoordinates(e);
        this.currentCoords = p;

        if (this.activeMode === 'brush' && this.isDrawing) {
            this.continueBrushStroke(p);
            return;
        }

        if (!this.isDrawing) return;

        if (this.activeMode === 'lasso') {
            const last = this.lassoPoints[this.lassoPoints.length - 1];
            if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 2) this.lassoPoints.push(p);
        }

        this.drawOverlay();
    },

    handlePointerUp: function () {
        if (!this.isOpen) return;

        if (this.activeMode === 'brush') {
            if (this.isDrawing) this.finishBrushStroke();
            return;
        }

        if (!this.isDrawing) return;
        this.isDrawing = false;

        if (this.activeMode === 'rect') this.finalizeRectangleSelection();
        else if (this.activeMode === 'ellipse') this.finalizeEllipseSelection();
        else if (this.activeMode === 'lasso') this.finalizeLassoSelection();

        this.drawOverlay();
    },

    handleDoubleClick: function () {
        if (this.isOpen && this.activeMode === 'poly' && this.polygonPoints.length >= 3) {
            this.finalizePolygonalSelection();
        }
    },

    handlePolygonPointerDown: function (p) {
        if (!this.isDrawing) {
            this.isDrawing = true;
            this.polygonPoints = [p];
            this.currentCoords = p;
            this.drawOverlay();
            return;
        }

        const first = this.polygonPoints[0];
        if (this.polygonPoints.length >= 3 && Math.hypot(p.x - first.x, p.y - first.y) <= 12) {
            this.finalizePolygonalSelection();
            return;
        }

        this.polygonPoints.push(p);
        this.currentCoords = p;
        this.drawOverlay();
    },

    beginBrushStroke: function (p) {
        const d = this.getWorkingDimensions();
        if (!d) return;

        this.isDrawing = true;
        this.brushLastPoint = {...p};
        if (!this.previewMask) this.previewMask = this.createEmptyMask(d.width, d.height);

        this.paintBrushAt(p.x, p.y);
        this.commitPreviewToCurrent();
        this.drawOverlay();
    },

    continueBrushStroke: function (p) {
        if (!this.isDrawing || !this.brushLastPoint) return;

        this.paintBrushLine(this.brushLastPoint, p);
        this.brushLastPoint = {...p};
        this.commitPreviewToCurrent();
        this.drawOverlay();
    },

    finishBrushStroke: function () {
        this.isDrawing = false;
        this.brushLastPoint = null;
        this.commitPreviewMask();
        this.drawOverlay();
    },

    paintBrushLine: function (a, b) {
        const distance = Math.hypot(b.x - a.x, b.y - a.y);
        const count = Math.max(1, Math.ceil(distance / Math.max(1, this.brushRadius * 0.25)));

        for (let i = 1; i <= count; i++) {
            const t = i / count;
            this.paintBrushAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
        }
    },

    paintBrushAt: function (x, y) {
        if (!this.previewMask) return;

        const p = this.displayToMask({x, y});
        const scale = this.getDisplayToMaskScale();
        const radius = Math.max(1, this.brushRadius * ((scale.x + scale.y) / 2));
        const r2 = radius * radius;
        const mx = Math.round(p.x);
        const my = Math.round(p.y);

        const minX = Math.max(0, Math.floor(mx - radius));
        const maxX = Math.min(this.previewMask.width - 1, Math.ceil(mx + radius));
        const minY = Math.max(0, Math.floor(my - radius));
        const maxY = Math.min(this.previewMask.height - 1, Math.ceil(my + radius));

        for (let py = minY; py <= maxY; py++) {
            for (let px = minX; px <= maxX; px++) {
                const dx = px - mx;
                const dy = py - my;
                if (dx * dx + dy * dy <= r2) {
                    const i = (py * this.previewMask.width + px) * 4;
                    this.previewMask.data[i] = 255;
                    this.previewMask.data[i + 1] = 255;
                    this.previewMask.data[i + 2] = 255;
                    this.previewMask.data[i + 3] = 255;
                }
            }
        }
    },

    finalizeRectangleSelection: function () {
        const r = this.getNormalizedRect(this.startCoords, this.currentCoords);
        if (r.width < 1 || r.height < 1) return;

        const d = this.getWorkingDimensions();
        if (!d) return;

        const mask = this.createEmptyMask(d.width, d.height);
        const a = this.displayToMask({x: r.x, y: r.y});
        const b = this.displayToMask({x: r.x + r.width, y: r.y + r.height});

        this.fillRectangle(mask, Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        this.applyNewCandidate(mask);
    },

    finalizeEllipseSelection: function () {
        const r = this.getNormalizedRect(this.startCoords, this.currentCoords);
        if (r.width < 1 || r.height < 1) return;

        const d = this.getWorkingDimensions();
        if (!d) return;

        const mask = this.createEmptyMask(d.width, d.height);
        const a = this.displayToMask({x: r.x, y: r.y});
        const b = this.displayToMask({x: r.x + r.width, y: r.y + r.height});

        this.fillEllipse(mask, Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        this.applyNewCandidate(mask);
    },

    finalizeLassoSelection: function () {
        if (this.lassoPoints.length < 3) {
            this.resetDrawingState();
            return;
        }

        const d = this.getWorkingDimensions();
        if (!d) return;

        const mask = this.createEmptyMask(d.width, d.height);
        const points = this.lassoPoints.map(p => this.displayToMask(p));

        this.fillPolygon(mask, points);
        this.applyNewCandidate(mask);
        this.resetDrawingState();
    },

    finalizePolygonalSelection: function () {
        if (this.polygonPoints.length < 3) {
            this.resetDrawingState();
            return;
        }

        const d = this.getWorkingDimensions();
        if (!d) return;

        const mask = this.createEmptyMask(d.width, d.height);
        const points = this.polygonPoints.map(p => this.displayToMask(p));

        this.fillPolygon(mask, points);
        this.applyNewCandidate(mask);
        this.resetDrawingState();
    },

    getNormalizedRect: function (a, b) {
        return {
            x: Math.min(a.x, b.x),
            y: Math.min(a.y, b.y),
            width: Math.abs(b.x - a.x),
            height: Math.abs(b.y - a.y)
        };
    },

    createEmptyMask: function (width, height) {
        return {
            width,
            height,
            data: new Uint8ClampedArray(width * height * 4)
        };
    },

    cloneMask: function (mask) {
        if (!mask) return null;
        return {
            width: mask.width,
            height: mask.height,
            data: new Uint8ClampedArray(mask.data),
            bounds: mask.bounds ? {...mask.bounds} : null
        };
    },

    fillRectangle: function (mask, x, y, width, height) {
        x = Math.max(0, Math.floor(x));
        y = Math.max(0, Math.floor(y));
        width = Math.ceil(width);
        height = Math.ceil(height);

        const x2 = Math.min(mask.width, x + width);
        const y2 = Math.min(mask.height, y + height);

        for (let py = y; py < y2; py++) {
            for (let px = x; px < x2; px++) {
                const i = (py * mask.width + px) * 4;
                mask.data[i] = 255;
                mask.data[i + 1] = 255;
                mask.data[i + 2] = 255;
                mask.data[i + 3] = 255;
            }
        }
    },

    fillEllipse: function (mask, x, y, width, height) {
        const rx = width / 2;
        const ry = height / 2;
        if (rx <= 0 || ry <= 0) return;

        const cx = x + rx;
        const cy = y + ry;
        const minX = Math.max(0, Math.floor(x));
        const maxX = Math.min(mask.width - 1, Math.ceil(x + width));
        const minY = Math.max(0, Math.floor(y));
        const maxY = Math.min(mask.height - 1, Math.ceil(y + height));

        for (let py = minY; py <= maxY; py++) {
            for (let px = minX; px <= maxX; px++) {
                const dx = (px + 0.5 - cx) / rx;
                const dy = (py + 0.5 - cy) / ry;
                if (dx * dx + dy * dy <= 1) {
                    const i = (py * mask.width + px) * 4;
                    mask.data[i] = 255;
                    mask.data[i + 1] = 255;
                    mask.data[i + 2] = 255;
                    mask.data[i + 3] = 255;
                }
            }
        }
    },

    fillPolygon: function (mask, points) {
        if (points.length < 3) return;

        let minY = mask.height;
        let maxY = 0;

        points.forEach(p => {
            minY = Math.min(minY, Math.floor(p.y));
            maxY = Math.max(maxY, Math.ceil(p.y));
        });

        minY = Math.max(0, minY);
        maxY = Math.min(mask.height - 1, maxY);

        for (let y = minY; y <= maxY; y++) {
            const intersections = [];

            for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
                const a = points[i];
                const b = points[j];

                if ((a.y > y) !== (b.y > y)) {
                    const x = a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y);
                    intersections.push(x);
                }
            }

            intersections.sort((a, b) => a - b);

            for (let i = 0; i < intersections.length - 1; i += 2) {
                const x1 = Math.max(0, Math.ceil(intersections[i]));
                const x2 = Math.min(mask.width - 1, Math.floor(intersections[i + 1]));

                for (let x = x1; x <= x2; x++) {
                    const idx = (y * mask.width + x) * 4;
                    mask.data[idx] = 255;
                    mask.data[idx + 1] = 255;
                    mask.data[idx + 2] = 255;
                    mask.data[idx + 3] = 255;
                }
            }
        }
    },

applyNewCandidate: function(candidate) {
    if (!candidate) return;

    if (this.operation === 'new' || !window.activeSelectionMask) {
        this.currentMask = candidate;
    } else {
        this.currentMask = this.combineMasks(window.activeSelectionMask, candidate, this.operation);
    }

    this.previewMask = null;
    this.applyMaskToGlobal();

    window.selectionProcessingActive = this.isOpen;

    this.notifyStateChange();
    this.drawOverlay();
},

    combineMasks: function (base, candidate, operation) {
        const width = Math.min(base.width, candidate.width);
        const height = Math.min(base.height, candidate.height);
        const out = this.createEmptyMask(width, height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                const a = base.data[i + 3] || 0;
                const b = candidate.data[i + 3] || 0;
                let value = b;

                if (operation === 'add') value = Math.max(a, b);
                else if (operation === 'subtract') value = Math.max(0, a - b);

                out.data[i] = 255;
                out.data[i + 1] = 255;
                out.data[i + 2] = 255;
                out.data[i + 3] = value;
            }
        }

        return out;
    },

    commitPreviewToCurrent: function () {
        if (!this.previewMask) return;

        if (!this.currentMask) {
            this.currentMask = this.cloneMask(this.previewMask);
        } else {
            this.currentMask = this.combineMasks(this.currentMask, this.previewMask, this.operation === 'new' ? 'add' : this.operation);
        }

        this.applyMaskToGlobal();
    },

    commitPreviewMask: function () {
        if (this.previewMask) {
            this.commitPreviewToCurrent();
            this.previewMask = null;
            this.notifyStateChange();
        }
    },

applyMaskToGlobal: function () {
    if (!this.currentMask) return;

    const bounds = this.calculateBounds(this.currentMask);

    const mask = {
        width: this.currentMask.width,
        height: this.currentMask.height,
        data: new Uint8ClampedArray(this.currentMask.data),
        bounds
    };

    window.activeSelectionMask = mask;
    window.selectionDisplayMask = mask;
    window.selectionProcessingActive = true;

    if (!window.imgState) window.imgState = {};
    if (!window.imgState.selection) window.imgState.selection = {};

    window.imgState.selection.active = true;
    window.imgState.selection.mode = this.activeMode;
    window.imgState.selection.bounds = {...bounds};
    window.imgState.selection.path = [...(this.lassoPoints || [])];
},

    calculateBounds: function (mask) {
        let minX = mask.width;
        let minY = mask.height;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < mask.height; y++) {
            for (let x = 0; x < mask.width; x++) {
                if ((mask.data[(y * mask.width + x) * 4 + 3] || 0) > 10) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        if (maxX < 0) return {x: 0, y: 0, width: 0, height: 0};

        return {
            x: minX,
            y: minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1
        };
    },

    createMagicWandSelection: function (point) {
        const target = this.getTargetCanvas();
        if (!target) return;

        const p = this.displayToMask(point);
        const x = Math.max(0, Math.min(target.width - 1, Math.round(p.x)));
        const y = Math.max(0, Math.min(target.height - 1, Math.round(p.y)));
        const ctx = target.getContext('2d');
        const image = ctx.getImageData(0, 0, target.width, target.height);
        const idx = (y * target.width + x) * 4;

        const r = image.data[idx];
        const g = image.data[idx + 1];
        const b = image.data[idx + 2];
        const tolerance = this.wandTolerance * 3;
        const mask = this.createEmptyMask(target.width, target.height);

        for (let i = 0; i < image.data.length; i += 4) {
            const diff = Math.abs(image.data[i] - r) + Math.abs(image.data[i + 1] - g) + Math.abs(image.data[i + 2] - b);
            if (diff <= tolerance) {
                mask.data[i] = 255;
                mask.data[i + 1] = 255;
                mask.data[i + 2] = 255;
                mask.data[i + 3] = 255;
            }
        }

        this.applyNewCandidate(mask);
    },

    createColorRangeSelection: function (point) {
        this.createMagicWandSelection(point);
    },

    createSubjectSelection: function () {
        const target = this.getTargetCanvas();
        if (!target) return;

        const ctx = target.getContext('2d');
        const image = ctx.getImageData(0, 0, target.width, target.height);
        const mask = this.createEmptyMask(target.width, target.height);

        let minX = target.width;
        let minY = target.height;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < target.height; y++) {
            for (let x = 0; x < target.width; x++) {
                const i = (y * target.width + x) * 4;
                const a = image.data[i + 3];

                if (a > 10) {
                    mask.data[i] = 255;
                    mask.data[i + 1] = 255;
                    mask.data[i + 2] = 255;
                    mask.data[i + 3] = a;
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
        }

        if (maxX >= 0) this.applyNewCandidate(mask);
    },

    drawSelectionBoundary: function (ctx, mask) {
        if (!mask || !mask.data || !mask.width || !mask.height) return;

        const w = mask.width;
        const h = mask.height;

        ctx.save();
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();

        const selected = (x, y) => {
            if (x < 0 || y < 0 || x >= w || y >= h) return false;
            return (mask.data[(y * w + x) * 4 + 3] || 0) > 10;
        };

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (!selected(x, y)) continue;

                const top = !selected(x, y - 1);
                const bottom = !selected(x, y + 1);
                const left = !selected(x - 1, y);
                const right = !selected(x + 1, y);

                const p00 = this.maskToDisplay({x, y});
                const p10 = this.maskToDisplay({x: x + 1, y});
                const p01 = this.maskToDisplay({x, y: y + 1});
                const p11 = this.maskToDisplay({x: x + 1, y: y + 1});

                if (top) {
                    ctx.moveTo(p00.x, p00.y);
                    ctx.lineTo(p10.x, p10.y);
                }

                if (bottom) {
                    ctx.moveTo(p01.x, p01.y);
                    ctx.lineTo(p11.x, p11.y);
                }

                if (left) {
                    ctx.moveTo(p00.x, p00.y);
                    ctx.lineTo(p01.x, p01.y);
                }

                if (right) {
                    ctx.moveTo(p10.x, p10.y);
                    ctx.lineTo(p11.x, p11.y);
                }
            }
        }

        ctx.stroke();
        ctx.restore();
    },

    drawOverlay: function () {
        if (!this.overlayCtx || !this.overlayCanvas) return;

        this.syncOverlaySize();

        const ctx = this.overlayCtx;
        ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        if (!this.isOpen) return;

        ctx.save();
        ctx.strokeStyle = '#00e5ff';
        ctx.fillStyle = '#00e5ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);

        if (this.isDrawing) {
            if (this.activeMode === 'rect') {
                const r = this.getNormalizedRect(this.startCoords, this.currentCoords);
                ctx.strokeRect(r.x, r.y, r.width, r.height);
            } else if (this.activeMode === 'ellipse') {
                const r = this.getNormalizedRect(this.startCoords, this.currentCoords);
                ctx.beginPath();
                ctx.ellipse(r.x + r.width / 2, r.y + r.height / 2, r.width / 2, r.height / 2, 0, 0, Math.PI * 2);
                ctx.stroke();
            } else if (this.activeMode === 'lasso') {
                if (this.lassoPoints.length) {
                    ctx.beginPath();
                    ctx.moveTo(this.lassoPoints[0].x, this.lassoPoints[0].y);
                    for (let i = 1; i < this.lassoPoints.length; i++) ctx.lineTo(this.lassoPoints[i].x, this.lassoPoints[i].y);
                    ctx.stroke();
                }
            } else if (this.activeMode === 'poly') {
                if (this.polygonPoints.length) {
                    ctx.beginPath();
                    ctx.moveTo(this.polygonPoints[0].x, this.polygonPoints[0].y);
                    for (let i = 1; i < this.polygonPoints.length; i++) ctx.lineTo(this.polygonPoints[i].x, this.polygonPoints[i].y);
                    ctx.lineTo(this.currentCoords.x, this.currentCoords.y);
                    ctx.stroke();

                    ctx.setLineDash([]);
                    for (const p of this.polygonPoints) ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
                }
            } else if (this.activeMode === 'brush') {
                if (this.brushLastPoint) {
                    const p = this.brushLastPoint;
                    ctx.setLineDash([]);
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, this.brushRadius, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
        } else if (this.currentMask) {
            this.drawSelectionBoundary(ctx, this.currentMask);
        } else if (window.activeSelectionMask) {
            this.drawSelectionBoundary(ctx, window.activeSelectionMask);
        }

        ctx.restore();
    },

    clearOverlay: function () {
        if (!this.overlayCtx || !this.overlayCanvas) return;
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    },

    resetDrawingState: function () {
        this.isDrawing = false;
        this.startCoords = {x: 0, y: 0};
        this.currentCoords = {x: 0, y: 0};
        this.lassoPoints = [];
        this.polygonPoints = [];
        this.brushLastPoint = null;
        this.previewMask = null;
    },

    syncToGlobalState: function() {
        if (!this.currentMask) return;

        this.applyMaskToGlobal();
        window.selectionProcessingActive = this.isOpen;
    },

    notifyStateChange: function () {
        if (window.SelectionManager && typeof window.SelectionManager.syncFromEngine === 'function') {
            window.SelectionManager.syncFromEngine();
        }

        if (window.CanvasEditor && typeof window.CanvasEditor.redraw === 'function') {
            window.CanvasEditor.redraw();
        } else if (window.CanvasEditor && typeof window.CanvasEditor.applyEffectsPipeline === 'function') {
            window.CanvasEditor.applyEffectsPipeline();
        }
    },

    confirmSelection: function() {
        if (this.currentMask) {
            this.applyMaskToGlobal();
        }

        window.selectionProcessingActive = false;

        this.resetDrawingState();
        this.setToolActive(false);
        this.clearOverlay();
        this.notifyStateChange();
    },
    discardSelection: function() {
        window.selectionProcessingActive = false;

        this.currentMask = null;
        this.previewMask = null;
        window.activeSelectionMask = null;

        if (window.imgState && window.imgState.selection) {
            window.imgState.selection.active = false;
            window.imgState.selection.bounds = null;
            window.imgState.selection.path = [];
        }

        this.resetDrawingState();
        this.setToolActive(false);
        this.clearOverlay();
        this.notifyStateChange();
    },

    clearSelection: function () {
        this.discardSelection();
    },

    minimizePanel: function () {
        const panel = document.getElementById('selectionPanel');
        const mini = document.getElementById('selectionPanelMini');

        if (panel) panel.style.display = 'none';

        if (mini) {
            mini.style.display = 'flex';

            const margin = 10;
            const maxLeft = Math.max(margin, window.innerWidth - mini.offsetWidth - margin);
            const maxTop = Math.max(margin, window.innerHeight - mini.offsetHeight - margin);

            const currentLeft = parseFloat(mini.style.left) || 20;
            const currentTop = parseFloat(mini.style.top) || 80;

            mini.style.left = `${Math.min(Math.max(margin, currentLeft), maxLeft)}px`;
            mini.style.top = `${Math.min(Math.max(margin, currentTop), maxTop)}px`;
        }
    },

    expandPanel: function () {
        const panel = document.getElementById('selectionPanel');
        const mini = document.getElementById('selectionPanelMini');

        if (mini) mini.style.display = 'none';

        if (panel) {
            panel.style.display = 'block';

            const margin = 10;
            const width = panel.offsetWidth || 280;
            const height = panel.offsetHeight || 500;

            const maxLeft = Math.max(margin, window.innerWidth - width - margin);
            const maxTop = Math.max(margin, window.innerHeight - height - margin);

            const currentLeft = parseFloat(panel.style.left) || 20;
            const currentTop = parseFloat(panel.style.top) || 80;

            panel.style.left = `${Math.min(Math.max(margin, currentLeft), maxLeft)}px`;
            panel.style.top = `${Math.min(Math.max(margin, currentTop), maxTop)}px`;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.SelectionEditor.init();
});

})();
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
window.activeSelectionMask = window.activeSelectionMask || null;
window.SelectionAdjustmentState = window.SelectionAdjustmentState || {
    global: { exposure: 0, contrast: 0, saturation: 0 },
    local: { exposure: 0, contrast: 0, saturation: 0 }
};

// Helper to update state when sliders move
window.updateSelectionAdjustment = function (type, key, value) {
    if (window.SelectionAdjustmentState[type]) {
        window.SelectionAdjustmentState[type][key] = value;
        if (window.CanvasEditor && typeof window.CanvasEditor.applyEffectsPipeline === 'function') {
            window.CanvasEditor.applyEffectsPipeline();
        }
    }
};

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
    currentMask: window.activeSelectionMask || null,
    previewMask: null,
    brushLastPoint: null,
    _eventsBound: false,
    _uiBound: false,
    selectionCommitted: false,

    init: function () {
        this.createOverlayCanvas();
        this.bindEvents();
        this.bindUIButtons();
        this.syncControls();
        this.updateButtonStates();
        this.updateModeControls();
        this.drawOverlay();
    },

    open: function () {
        this.isOpen = true;
        this.selectionCommitted = false;
        if (window.activeSelectionMask && !this.currentMask) this.currentMask = this.cloneMask(window.activeSelectionMask);
        window.selectionProcessingActive = !!this.currentMask;
        this.createOverlayCanvas();
        this.syncOverlaySize();
        this.updateButtonStates();
        this.updateModeControls();
        this.drawOverlay();

        // Switch sliders to show local values
        if (window.CanvasEditor && typeof window.CanvasEditor.syncSliderUI === 'function') {
            window.CanvasEditor.syncSliderUI(window.SelectionAdjustmentState.local);
        }

        this.notifyStateChange();
    },

    close: function () {
        this.isOpen = false;
        this.isDrawing = false;
        this.previewMask = null;
        this.brushLastPoint = null;
        window.selectionProcessingActive = false;
        this.updateButtonStates();
        this.updateModeControls();
       this.clearOverlay();

        // Switch sliders back to show global values
        if (window.CanvasEditor && typeof window.CanvasEditor.syncSliderUI === 'function') {
            window.CanvasEditor.syncSliderUI(window.SelectionAdjustmentState.global);
        }

        this.notifyStateChange();
    },

    toggle: function () {
        if (this.isOpen) this.close();
        else this.open();
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
            canvas.style.zIndex = '5';
            canvas.style.left = '0';
            canvas.style.top = '0';

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
            width: Math.max(1, width),
            height: Math.max(1, height),
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

    updateModeButtonState: function () {
        this.updateButtonStates();
    },

    setMode: function (mode) {
        if (mode === 'polygonal') mode = 'poly';
        if (!MODES.includes(mode)) return;

        this.activeMode = mode;
        this.resetDrawingState();
        this.updateButtonStates();
        this.updateModeControls();
        this.drawOverlay();
    },

    setOperation: function (operation) {
        if (!['new', 'add', 'subtract'].includes(operation)) return;

        this.operation = operation;
        this.updateOperationButtonState();
    },

    updateOperationButtonState: function () {
        document.querySelectorAll('.op-btn').forEach(btn => {
            const active = btn.getAttribute('data-op') === this.operation;
            btn.classList.toggle('active', active);
            btn.style.background = active ? '#2a2a2a' : 'transparent';
            btn.style.color = active ? '#fff' : '#888';
        });
    },

    setToolActive: function (active) {
        this.isOpen = !!active;
        window.selectionProcessingActive = !!active;

        if (!active) {
            this.isDrawing = false;
            this.lassoPoints = [];
            this.polygonPoints = [];
            this.brushLastPoint = null;
            this.previewMask = null;
            this.clearOverlay();
        }

        this.updateButtonStates();
        this.updateModeControls();
    },

    updateButtonStates: function () {
        document.querySelectorAll('.selection-mode-btn').forEach(btn => {
            const mode = btn.getAttribute('data-mode');
            const normalized = mode === 'polygonal' ? 'poly' : mode;
            const active = this.isOpen && normalized === this.activeMode;
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

                this.setMode(mode);
                this.setToolActive(true);
                this.drawOverlay();
            });
        });

        document.querySelectorAll('.op-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();

                const op = btn.getAttribute('data-op');
                this.setOperation(op);
            });
        });

        const wand = document.getElementById('wandTolerance');
        if (wand) {
            wand.addEventListener('input', () => {
                this.wandTolerance = Math.max(0, Math.min(255, parseInt(wand.value, 10) || DEFAULTS.wandTolerance));
                const v = document.getElementById('wandToleranceVal');
                if (v) v.textContent = this.wandTolerance;
            });
        }

        const color = document.getElementById('colorTolerance');
        if (color) {
            color.addEventListener('input', () => {
                this.colorTolerance = Math.max(0, Math.min(255, parseInt(color.value, 10) || DEFAULTS.colorTolerance));
                const v = document.getElementById('colorToleranceVal');
                if (v) v.textContent = this.colorTolerance;
            });
        }

        const brush = document.getElementById('selectionBrushSize');
        if (brush) {
            brush.addEventListener('input', () => {
                this.brushRadius = Math.max(1, parseInt(brush.value, 10) || DEFAULTS.brushRadius);
                const v = document.getElementById('selectionBrushSizeVal');
                if (v) v.textContent = `${this.brushRadius}px`;
                this.drawOverlay();
            });
        }

        const feather = document.getElementById('selectionFeather');
        if (feather) {
            feather.addEventListener('input', () => {
                this.feather = Math.max(0, parseInt(feather.value, 10) || 0);
                const v = document.getElementById('selectionFeatherVal');
                if (v) v.textContent = `${this.feather}px`;

                if (this.currentMask) {
                    const base = this.cloneMask(this.currentMask);
                    this.currentMask = this.feather > 0 ? this.featherMask(base, this.feather) : base;
                    this.applyMaskToGlobal();
                    this.drawOverlay();
                }
            });
        }

        const confirm = document.getElementById('confirmSelectionBtn');
        if (confirm) {
            confirm.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                this.confirmSelection();
            });
        }

        const discard = document.getElementById('discardSelectionBtn');
        if (discard) {
            discard.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                this.discardSelection();
            });
        }

        const minimize = document.getElementById('minimizeSelectionBtn');
        if (minimize) {
            minimize.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                this.minimizePanel();
            });
        }

        const expand = document.getElementById('expandSelectionBtn');
        if (expand) {
            expand.addEventListener('click', e => {
                e.preventDefault();
                e.stopPropagation();
                this.expandPanel();
            });
        }

        const mini = document.getElementById('selectionPanelMini');
        if (mini) {
            mini.addEventListener('click', e => {
                if (e.target.closest('#expandSelectionBtn')) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.expandPanel();
                }
            });
        }
    },

    syncControls: function () {
        const wand = document.getElementById('wandTolerance');
        if (wand) wand.value = this.wandTolerance;

        const wandVal = document.getElementById('wandToleranceVal');
        if (wandVal) wandVal.textContent = this.wandTolerance;

        const color = document.getElementById('colorTolerance');
        if (color) color.value = this.colorTolerance;

        const colorVal = document.getElementById('colorToleranceVal');
        if (colorVal) colorVal.textContent = this.colorTolerance;

        const brush = document.getElementById('selectionBrushSize');
        if (brush) brush.value = this.brushRadius;

        const brushVal = document.getElementById('selectionBrushSizeVal');
        if (brushVal) brushVal.textContent = `${this.brushRadius}px`;

        const feather = document.getElementById('selectionFeather');
        if (feather) feather.value = this.feather;

        const featherVal = document.getElementById('selectionFeatherVal');
        if (featherVal) featherVal.textContent = `${this.feather}px`;

        this.updateOperationButtonState();
        this.updateModeControls();
        this.updateButtonStates();
    },

    updateModeControls: function () {
        const wand = document.getElementById('wandControls');
        const brush = document.getElementById('brushSizeControls');
        const color = document.getElementById('colorRangeControls');

        if (wand) wand.style.display = this.isOpen && this.activeMode === 'wand' ? 'block' : 'none';
        if (brush) brush.style.display = this.isOpen && this.activeMode === 'brush' ? 'block' : 'none';
        if (color) color.style.display = this.isOpen && this.activeMode === 'eyedropper' ? 'block' : 'none';
    },

bindEvents: function () {
        const canvas = document.getElementById('editorCanvas');
        if (!canvas || this._eventsBound) return;

        // Use pointer events exclusively to prevent double triggers
        this.boundPointerDown = this.handlePointerDown.bind(this);
        this.boundPointerMove = this.handlePointerMove.bind(this);
        this.boundPointerUp = this.handlePointerUp.bind(this);

        canvas.addEventListener('pointerdown', this.boundPointerDown);
        canvas.addEventListener('pointermove', this.boundPointerMove);
        window.addEventListener('pointerup', this.boundPointerUp);

        this._eventsBound = true;
    },

    handlePointerDown: function (e) {
        if (!this.isOpen || e.button !== 0) return;

        e.preventDefault();

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
            e.preventDefault();
            this.continueBrushStroke(p);
            return;
        }

        if (!this.isDrawing) return;

        e.preventDefault();

        if (this.activeMode === 'lasso') {
            const last = this.lassoPoints[this.lassoPoints.length - 1];
            if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 2) this.lassoPoints.push(p);
        }

        this.drawOverlay();
    },

    handlePointerUp: function (e) {
        if (!this.isOpen) return;

        if (e && e.button !== undefined && e.button !== 0) return;

        if (this.activeMode === 'brush') {
            if (this.isDrawing) this.finishBrushStroke();
            return;
        }

        if (!this.isDrawing) return;

        if (e) e.preventDefault();

        this.isDrawing = false;

        if (this.activeMode === 'rect') this.finalizeRectangleSelection();
        else if (this.activeMode === 'ellipse') this.finalizeEllipseSelection();
        else if (this.activeMode === 'lasso') this.finalizeLassoSelection();

        this.drawOverlay();
    },

    handleDoubleClick: function () {
        if (this.isOpen && this.activeMode === 'poly' && this.polygonPoints.length >= 3) this.finalizePolygonalSelection();
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
        this.previewMask = this.createEmptyMask(d.width, d.height);

        this.paintBrushAt(p.x, p.y);
        this.drawOverlay();
    },

    continueBrushStroke: function (p) {
        if (!this.isDrawing || !this.brushLastPoint) return;

        this.paintBrushLine(this.brushLastPoint, p);
        this.brushLastPoint = {...p};
        this.drawOverlay();
    },

    finishBrushStroke: function () {
        if (!this.previewMask) {
            this.resetDrawingState();
            return;
        }

        const candidate = this.previewMask;
        this.previewMask = null;
        this.isDrawing = false;
        this.brushLastPoint = null;

        this.applyNewCandidate(candidate);
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
        if (r.width < 1 || r.height < 1) {
            this.resetDrawingState();
            return;
        }

        const d = this.getWorkingDimensions();
        if (!d) return;

        const mask = this.createEmptyMask(d.width, d.height);
        const a = this.displayToMask({x: r.x, y: r.y});
        const b = this.displayToMask({x: r.x + r.width, y: r.y + r.height});

        this.fillRectangle(mask, Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        this.applyNewCandidate(mask);
        this.resetDrawingState();
    },

    finalizeEllipseSelection: function () {
        const r = this.getNormalizedRect(this.startCoords, this.currentCoords);
        if (r.width < 1 || r.height < 1) {
            this.resetDrawingState();
            return;
        }

        const d = this.getWorkingDimensions();
        if (!d) return;

        const mask = this.createEmptyMask(d.width, d.height);
        const a = this.displayToMask({x: r.x, y: r.y});
        const b = this.displayToMask({x: r.x + r.width, y: r.y + r.height});

        this.fillEllipse(mask, Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        this.applyNewCandidate(mask);
        this.resetDrawingState();
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
            data: new Uint8ClampedArray(width * height * 4),
            bounds: null
        };
    },

    cloneMask: function (mask) {
        if (!mask || !mask.data) return null;

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
        if (!points || points.length < 3) return;

        let minY = mask.height;
        let maxY = -1;

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

            for (let i = 0; i + 1 < intersections.length; i += 2) {
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

    combineMasks: function (base, candidate, operation) {
        if (!base) return this.cloneMask(candidate);
        if (!candidate) return this.cloneMask(base);

        if (base.width !== candidate.width || base.height !== candidate.height) {
            return this.resampleMask(candidate, base.width, base.height);
        }

        const out = this.createEmptyMask(base.width, base.height);

        for (let y = 0; y < base.height; y++) {
            for (let x = 0; x < base.width; x++) {
                const i = (y * base.width + x) * 4;
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

    resampleMask: function (mask, width, height) {
        if (!mask || !mask.data) return null;
        if (mask.width === width && mask.height === height) return this.cloneMask(mask);

        const src = document.createElement('canvas');
        const dst = document.createElement('canvas');

        src.width = mask.width;
        src.height = mask.height;
        dst.width = width;
        dst.height = height;

        const sctx = src.getContext('2d');
        const dctx = dst.getContext('2d');

        const image = new ImageData(new Uint8ClampedArray(mask.data), mask.width, mask.height);
        sctx.putImageData(image, 0, 0);
        dctx.drawImage(src, 0, 0, width, height);

        return {
            width,
            height,
            data: new Uint8ClampedArray(dctx.getImageData(0, 0, width, height).data),
            bounds: null
        };
    },

    applyNewCandidate: function (candidate) {
        if (!candidate) return;

        let prepared = this.cloneMask(candidate);

        if (this.feather > 0) prepared = this.featherMask(prepared, this.feather);

        if (this.operation === 'new' || !this.currentMask) {
            this.currentMask = prepared;
        } else {
            this.currentMask = this.combineMasks(this.currentMask, prepared, this.operation);
        }

        this.previewMask = null;
        this.selectionCommitted = false;

        this.applyMaskToGlobal();
        window.selectionProcessingActive = !!this.isOpen;

        this.notifyStateChange();
        this.drawOverlay();
    },

    commitPreviewToCurrent: function () {
        if (!this.previewMask) return;

        const candidate = this.cloneMask(this.previewMask);

        if (!this.currentMask) {
            this.currentMask = candidate;
        } else {
            this.currentMask = this.combineMasks(this.currentMask, candidate, this.operation === 'new' ? 'add' : this.operation);
        }

        this.previewMask = null;
        this.applyMaskToGlobal();
    },

    commitPreviewMask: function () {
        if (!this.previewMask) return;

        this.commitPreviewToCurrent();
        this.notifyStateChange();
        this.drawOverlay();
    },

    featherMask: function (mask, radius) {
        if (!mask || !mask.data || radius <= 0) return mask;

        const w = mask.width;
        const h = mask.height;
        const r = Math.max(1, Math.round(radius));
        const src = new Uint8ClampedArray(mask.data);
        const tmp = new Uint8ClampedArray(w * h);
        const out = new Uint8ClampedArray(mask.data.length);

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let sum = 0;
                let count = 0;

                for (let k = -r; k <= r; k++) {
                    const xx = x + k;

                    if (xx >= 0 && xx < w) {
                        sum += src[(y * w + xx) * 4 + 3];
                        count++;
                    }
                }

                tmp[y * w + x] = Math.round(sum / Math.max(1, count));
            }
        }

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                let sum = 0;
                let count = 0;

                for (let k = -r; k <= r; k++) {
                    const yy = y + k;

                    if (yy >= 0 && yy < h) {
                        sum += tmp[yy * w + x];
                        count++;
                    }
                }

                const i = (y * w + x) * 4;
                const alpha = Math.max(0, Math.min(255, Math.round(sum / Math.max(1, count))));

                out[i] = 255;
                out[i + 1] = 255;
                out[i + 2] = 255;
                out[i + 3] = alpha;
            }
        }

        mask.data = out;
        mask.bounds = null;

        return mask;
    },

    calculateBounds: function (mask) {
        if (!mask || !mask.data) return {x: 0, y: 0, width: 0, height: 0};

        let minX = mask.width;
        let minY = mask.height;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < mask.height; y++) {
            for (let x = 0; x < mask.width; x++) {
                if ((mask.data[(y * mask.width + x) * 4 + 3] || 0) > 10) {
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
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
        if (!target || !point) return;

        const ctx = target.getContext('2d', {willReadFrequently: true});
        const image = ctx.getImageData(0, 0, target.width, target.height);
        const p = this.displayToMask(point);

        const sx = Math.max(0, Math.min(target.width - 1, Math.round(p.x)));
        const sy = Math.max(0, Math.min(target.height - 1, Math.round(p.y)));
        const seed = (sy * target.width + sx) * 4;

        const sr = image.data[seed];
        const sg = image.data[seed + 1];
        const sb = image.data[seed + 2];
        const sa = image.data[seed + 3];

        const tolerance = Math.max(0, Number(this.wandTolerance) || DEFAULTS.wandTolerance) * 3;
        const mask = this.createEmptyMask(target.width, target.height);

        if (sa <= 10) {
            this.applyNewCandidate(mask);
            return;
        }

        const visited = new Uint8Array(target.width * target.height);
        const queue = new Int32Array(target.width * target.height);

        let head = 0;
        let tail = 0;

        const seedPos = sy * target.width + sx;

        queue[tail++] = seedPos;
        visited[seedPos] = 1;

        while (head < tail) {
            const pos = queue[head++];
            const x = pos % target.width;
            const y = Math.floor(pos / target.width);
            const i = pos * 4;

            const a = image.data[i + 3];
            const diff = Math.abs(image.data[i] - sr) + Math.abs(image.data[i + 1] - sg) + Math.abs(image.data[i + 2] - sb);

            if (a <= 10 || diff > tolerance) continue;

            mask.data[i] = 255;
            mask.data[i + 1] = 255;
            mask.data[i + 2] = 255;
            mask.data[i + 3] = a;

            const enqueue = n => {
                if (visited[n]) return;

                const ni = n * 4;
                const na = image.data[ni + 3];
                const nd = Math.abs(image.data[ni] - sr) + Math.abs(image.data[ni + 1] - sg) + Math.abs(image.data[ni + 2] - sb);

                if (na > 10 && nd <= tolerance) {
                    visited[n] = 1;
                    queue[tail++] = n;
                }
            };

            if (x > 0) enqueue(pos - 1);
            if (x < target.width - 1) enqueue(pos + 1);
            if (y > 0) enqueue(pos - target.width);
            if (y < target.height - 1) enqueue(pos + target.width);
        }

        this.applyNewCandidate(mask);
    },

    createColorRangeSelection: function (point) {
        const target = this.getTargetCanvas();
        if (!target || !point) return;

        const ctx = target.getContext('2d', {willReadFrequently: true});
        const image = ctx.getImageData(0, 0, target.width, target.height);
        const p = this.displayToMask(point);

        const x = Math.max(0, Math.min(target.width - 1, Math.round(p.x)));
        const y = Math.max(0, Math.min(target.height - 1, Math.round(p.y)));
        const seed = (y * target.width + x) * 4;

        const targetR = image.data[seed];
        const targetG = image.data[seed + 1];
        const targetB = image.data[seed + 2];

        const tolerance = Math.max(0, Number(this.colorTolerance) || DEFAULTS.colorTolerance) * 3;
        const mask = this.createEmptyMask(target.width, target.height);

        for (let i = 0; i < image.data.length; i += 4) {
            const alpha = image.data[i + 3];

            if (alpha <= 10) continue;

            const diff = Math.abs(image.data[i] - targetR) + Math.abs(image.data[i + 1] - targetG) + Math.abs(image.data[i + 2] - targetB);

            if (diff <= tolerance) {
                mask.data[i] = 255;
                mask.data[i + 1] = 255;
                mask.data[i + 2] = 255;
                mask.data[i + 3] = alpha;
            }
        }

        this.applyNewCandidate(mask);
    },

    createSubjectSelection: function () {
        const target = this.getTargetCanvas();
        if (!target) return;

        const ctx = target.getContext('2d', {willReadFrequently: true});
        const image = ctx.getImageData(0, 0, target.width, target.height);
        const mask = this.createEmptyMask(target.width, target.height);

        for (let i = 0; i < image.data.length; i += 4) {
            const alpha = image.data[i + 3];

            if (alpha > 10) {
                mask.data[i] = 255;
                mask.data[i + 1] = 255;
                mask.data[i + 2] = 255;
                mask.data[i + 3] = alpha;
            }
        }

        this.applyNewCandidate(mask);
    },

    drawSelectionBoundary: function (ctx, mask) {
        if (!mask || !mask.data || !mask.width || !mask.height) return;

        const w = mask.width;
        const h = mask.height;

        const selected = (x, y) => {
            if (x < 0 || y < 0 || x >= w || y >= h) return false;
            return (mask.data[(y * w + x) * 4 + 3] || 0) > 10;
        };

        ctx.save();
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (!selected(x, y)) continue;

                const top = !selected(x, y - 1);
                const bottom = !selected(x, y + 1);
                const left = !selected(x - 1, y);
                const right = !selected(x + 1, y);

                if (top) {
                    const a = this.maskToDisplay({x, y});
                    const b = this.maskToDisplay({x: x + 1, y});
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                }

                if (bottom) {
                    const a = this.maskToDisplay({x, y: y + 1});
                    const b = this.maskToDisplay({x: x + 1, y: y + 1});
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                }

                if (left) {
                    const a = this.maskToDisplay({x, y});
                    const b = this.maskToDisplay({x, y: y + 1});
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                }

                if (right) {
                    const a = this.maskToDisplay({x: x + 1, y});
                    const b = this.maskToDisplay({x: x + 1, y: y + 1});
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
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

                    for (let i = 1; i < this.lassoPoints.length; i++) {
                        ctx.lineTo(this.lassoPoints[i].x, this.lassoPoints[i].y);
                    }

                    ctx.stroke();
                }
            } else if (this.activeMode === 'poly') {
                if (this.polygonPoints.length) {
                    ctx.beginPath();
                    ctx.moveTo(this.polygonPoints[0].x, this.polygonPoints[0].y);

                    for (let i = 1; i < this.polygonPoints.length; i++) {
                        ctx.lineTo(this.polygonPoints[i].x, this.polygonPoints[i].y);
                    }

                    ctx.lineTo(this.currentCoords.x, this.currentCoords.y);
                    ctx.stroke();

                    ctx.setLineDash([]);

                    for (const p of this.polygonPoints) {
                        ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
                    }
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

applyMaskToGlobal: function () {
        if (!this.currentMask) return;

        window.activeSelectionMask = this.cloneMask(this.currentMask);
        window.selectionDisplayMask = this.cloneMask(this.currentMask);

        // Notify rendering pipeline to composite local + global pixel math
        if (window.CanvasEditor && typeof window.CanvasEditor.applyCompositeAdjustments === 'function') {
            window.CanvasEditor.applyCompositeAdjustments(
                window.SelectionAdjustmentState.global,
                window.SelectionAdjustmentState.local,
                window.activeSelectionMask
            );
        }
    },

    syncToGlobalState: function () {
        if (!this.currentMask && window.activeSelectionMask) this.currentMask = this.cloneMask(window.activeSelectionMask);
        if (!this.currentMask) return;

        this.applyMaskToGlobal();
        window.selectionProcessingActive = !!this.isOpen;
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

    confirmSelection: function () {
        if (this.currentMask) {
            this.applyMaskToGlobal();
            this.selectionCommitted = true;
        }

        window.selectionProcessingActive = false;

        if (window.imgState) {
            if (!window.imgState.selection) window.imgState.selection = {};
            window.imgState.selection.active = false;
            window.imgState.selection.committed = !!this.selectionCommitted;
        }

        this.isOpen = false;
        this.resetDrawingState();
        this.updateButtonStates();
        this.updateModeControls();
        this.clearOverlay();
        this.notifyStateChange();
    },

    discardSelection: function () {
        window.selectionProcessingActive = false;
        this.selectionCommitted = false;
        this.currentMask = null;
        this.previewMask = null;

        window.activeSelectionMask = null;
        window.selectionDisplayMask = null;

        // Reset local adjustments
        window.SelectionAdjustmentState.local = { exposure: 0, contrast: 0, saturation: 0 };

        // Switch sliders back to show global values
        if (window.CanvasEditor && typeof window.CanvasEditor.syncSliderUI === 'function') {
            window.CanvasEditor.syncSliderUI(window.SelectionAdjustmentState.global);
        }

        if (window.imgState && window.imgState.selection) {
            window.imgState.selection.active = false;
            window.imgState.selection.committed = false;
            window.imgState.selection.bounds = null;
            window.imgState.selection.path = [];
        }

        this.resetDrawingState();
        this.isOpen = false;
        this.updateButtonStates();
        this.updateModeControls();
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.SelectionEditor.init(), {once: true});
} else {
    window.SelectionEditor.init();
}

})();
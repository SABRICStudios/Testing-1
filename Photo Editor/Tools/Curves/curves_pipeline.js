/**
 * Visuals Photo Editor - Curves Interactive Engine
 * Controls coordinate transformations, point dragging, and mathematical splines.
 */

let channelPoints = {
    rgb:   [{x: 0, y: 256}, {x: 256, y: 0}],
    red:   [{x: 0, y: 256}, {x: 256, y: 0}],
    green: [{x: 0, y: 256}, {x: 256, y: 0}],
    blue:  [{x: 0, y: 256}, {x: 256, y: 0}]
};

let fallbackChannelPoints = null;
let activeDragPointIndex = null;
let gridCanvasCtx = null;

function initCurvesEngine() {
    const canvas = document.getElementById('curvesGridCanvas');
    if (canvas) gridCanvasCtx = canvas.getContext('2d');

    if (!fallbackChannelPoints) {
        fallbackChannelPoints = JSON.parse(JSON.stringify(channelPoints));
    }

    setupSvgMouseListeners(); // Initializes unified pointers
    updateCurvesUI();
}

function updateCurvesUI() {
    drawBackgroundGridAndMetrics();
    renderSplinePathAndNodes();
}

function drawBackgroundGridAndMetrics() {
    if (!gridCanvasCtx) return;
    
    gridCanvasCtx.clearRect(0, 0, 256, 256);
    gridCanvasCtx.strokeStyle = '#2d2d2d';
    gridCanvasCtx.lineWidth = 1;

    const step = 256 / 4;
    for (let i = 1; i < 4; i++) {
        gridCanvasCtx.beginPath();
        gridCanvasCtx.moveTo(i * step, 0);
        gridCanvasCtx.lineTo(i * step, 256);
        gridCanvasCtx.stroke();

        gridCanvasCtx.beginPath();
        gridCanvasCtx.moveTo(0, i * step);
        gridCanvasCtx.lineTo(256, i * step);
        gridCanvasCtx.stroke();
    }
}

function renderSplinePathAndNodes() {
    const channel = CurvesEditor.activeChannel;
    const points = channelPoints[channel];
    const pathEl = document.getElementById('curveSplinePath');
    const nodesGroup = document.getElementById('curvesPointsGroup');

    if (!pathEl || !nodesGroup) return;

    let pathData = "";
    if (points.length === 2) {
        pathData = `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    } else {
        pathData = `M ${points[0].x} ${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(i - 1, 0)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(i + 2, points.length - 1)];

            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;

            pathData += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
        }
    }

    pathEl.setAttribute('d', pathData);

    let themeColor = "#00adb5"; 
    if (channel === 'red') themeColor = "#ff4d4d";
    else if (channel === 'green') themeColor = "#4dff4d";
    else if (channel === 'blue') themeColor = "#4d4dff";
    pathEl.setAttribute('stroke', themeColor);

    nodesGroup.innerHTML = "";
    points.forEach((pt, index) => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute('cx', pt.x);
        circle.setAttribute('cy', pt.y);
        circle.setAttribute('r', '5.5');
        circle.setAttribute('class', 'svg-curve-node');
        circle.style.stroke = themeColor;
        circle.setAttribute('data-index', index);
        circle.setAttribute('filter', 'url(#nodeGlow)');
        nodesGroup.appendChild(circle);
    });

    generateCurvesLUT(channel, points);
}

/**
 * FIXED FOR ANDROID: Converted standard desktop mouse clicks into PointerEvents.
 * This inherently binds touch inputs seamlessly and implements throttled live rendering downsampling.
 */
function setupSvgMouseListeners() {
    const svg = document.getElementById('curvesInteractiveSvg');
    const inputReadout = document.getElementById('curveInputVal');
    const outputReadout = document.getElementById('curveOutputVal');

    if (!svg) return;

    function getPointerCoords(e) {
        const rect = svg.getBoundingClientRect();
        // Client variables extraction supporting multi-touch offsets reliably
        const clientX = e.touches && e.touches.length ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches && e.touches.length ? e.touches[0].clientY : e.clientY;
        
        let x = Math.round(clientX - rect.left);
        let y = Math.round(clientY - rect.top);
        return {
            x: Math.max(0, Math.min(256, x)),
            y: Math.max(0, Math.min(256, y))
        };
    }

    // pointerdown intercept handles mobile screen touches instantly
    svg.addEventListener('pointerdown', (e) => {
        svg.setPointerCapture(e.pointerId); // Locks inputs execution context
        const coords = getPointerCoords(e);
        const channel = CurvesEditor.activeChannel;
        const points = channelPoints[channel];

        if (inputReadout) inputReadout.textContent = coords.x;
        if (outputReadout) outputReadout.textContent = 256 - coords.y;

        if (e.target.classList.contains('svg-curve-node')) {
            activeDragPointIndex = parseInt(e.target.getAttribute('data-index'));
            e.target.classList.add('active-node');
            window.CanvasEditor.isScrubbing = true; // High performance preview engagement
            return;
        }

        if (points.length < 10) { 
            let insertIdx = 0;
            while (insertIdx < points.length && points[insertIdx].x < coords.x) {
                insertIdx++;
            }
            points.splice(insertIdx, 0, coords);
            activeDragPointIndex = insertIdx;
            window.CanvasEditor.isScrubbing = true;
            updateCurvesUI();
        }
    });

    svg.addEventListener('pointermove', (e) => {
        if (activeDragPointIndex === null) return;

        const coords = getPointerCoords(e);
        const channel = CurvesEditor.activeChannel;
        const points = channelPoints[channel];
        
        if (inputReadout) inputReadout.textContent = coords.x;
        if (outputReadout) outputReadout.textContent = 256 - coords.y;

        const leftLimit = (activeDragPointIndex === 0) ? 0 : points[activeDragPointIndex - 1].x + 2;
        const rightLimit = (activeDragPointIndex === points.length - 1) ? 256 : points[activeDragPointIndex + 1].x - 2;

        let targetX = coords.x;
        if (activeDragPointIndex === 0) targetX = 0; 
        else if (activeDragPointIndex === points.length - 1) targetX = 256;
        else {
            targetX = Math.max(leftLimit, Math.min(rightLimit, targetX));
        }

        points[activeDragPointIndex].x = targetX;
        points[activeDragPointIndex].y = coords.y;

        updateCurvesUI();
        applyLiveCurvesFilterStub();
    });

    const endDragRoutine = (e) => {
        if (activeDragPointIndex !== null) {
            const activeNode = svg.querySelector('.active-node');
            if (activeNode) activeNode.classList.remove('active-node');
            activeDragPointIndex = null;
            
            // Release downsampling rendering layer smoothly via debounced closure routines
            window.CanvasEditor.isScrubbing = false;
            window.canvasRenderPending = false;
            applyLiveCurvesFilterStub();
        }
    };

    svg.addEventListener('pointerup', endDragRoutine);
    svg.addEventListener('pointercancel', endDragRoutine);
}

function generateCurvesLUT(channel, points) {
    let lut = new Uint8Array(256);
    
    if (!points || points.length === 0) {
        for (let i = 0; i < 256; i++) lut[i] = i;
        CurvesEditor.curvesLUTs[channel] = lut;
        syncToPhotoEditorPipeline();
        return;
    }

    const normalizedPoints = points.map(pt => ({
        x: pt.x,
        y: 256 - pt.y
    }));

    for (let i = 0; i < 256; i++) {
        const targetX = i;

        if (targetX <= normalizedPoints[0].x) {
            lut[i] = Math.min(255, Math.max(0, Math.round((normalizedPoints[0].y / 256) * 255)));
            continue;
        }
        if (targetX >= normalizedPoints[normalizedPoints.length - 1].x) {
            lut[i] = Math.min(255, Math.max(0, Math.round((normalizedPoints[normalizedPoints.length - 1].y / 256) * 255)));
            continue;
        }

        let idx = 0;
        while (idx < normalizedPoints.length - 1 && normalizedPoints[idx + 1].x < targetX) {
            idx++;
        }

        const p1 = normalizedPoints[idx];
        const p2 = normalizedPoints[idx + 1];
        const p0 = normalizedPoints[Math.max(idx - 1, 0)];
        const p3 = normalizedPoints[Math.min(idx + 2, normalizedPoints.length - 1)];

        const t = (targetX - p1.x) / (p2.x - p1.x);
        const t2 = t * t;
        const t3 = t2 * t;

        const h1 = 2 * t3 - 3 * t2 + 1;
        const h2 = -2 * t3 + 3 * t2;
        const h3 = t3 - 2 * t2 + t;
        const h4 = t3 - t2;

        const m1 = (p2.x - p0.x) === 0 ? 0 : (p2.y - p0.y) / 6;
        const m2 = (p3.x - p1.x) === 0 ? 0 : (p3.y - p1.y) / 6;

        const calculatedY = h1 * p1.y + h2 * p2.y + h3 * m1 + h4 * m2;
        lut[i] = Math.min(255, Math.max(0, Math.round((calculatedY / 256) * 255)));
    }
    
    CurvesEditor.curvesLUTs[channel] = lut;
    syncToPhotoEditorPipeline();
}

function syncToPhotoEditorPipeline() {
    const masterLut = CurvesEditor.curvesLUTs.rgb   || Array.from({length: 256}, (_, i) => i);
    const redLut    = CurvesEditor.curvesLUTs.red   || Array.from({length: 256}, (_, i) => i);
    const greenLut  = CurvesEditor.curvesLUTs.green || Array.from({length: 256}, (_, i) => i);
    const blueLut   = CurvesEditor.curvesLUTs.blue  || Array.from({length: 256}, (_, i) => i);

    window.CurvesManager = {
        activeState: {
            active: true,
            lutR: new Uint8Array(256).map((_, i) => redLut[masterLut[i]]),
            lutG: new Uint8Array(256).map((_, i) => greenLut[masterLut[i]]),
            lutB: new Uint8Array(256).map((_, i) => blueLut[masterLut[i]])
        }
    };
}

function resetCurrentChannel() {
    const channel = CurvesEditor.activeChannel;
    channelPoints[channel] = [{x: 0, y: 256}, {x: 256, y: 0}];
    updateCurvesUI();
    applyLiveCurvesFilterStub();
}

function discardCurvesEngineChanges() {
    if (fallbackChannelPoints) {
        channelPoints = JSON.parse(JSON.stringify(fallbackChannelPoints));
    }
}

function applyLiveCurvesFilterStub() {
    window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
}
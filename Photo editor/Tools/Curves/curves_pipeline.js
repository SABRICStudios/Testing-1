/**
 * Visuals Photo Editor - Curves Interactive Engine
 * Controls coordinate transformations, point dragging, and mathematical splines.
 */

// Coordinates dataset storing default points array maps for each isolated channel
let channelPoints = {
    rgb:   [{x: 0, y: 256}, {x: 256, y: 0}],
    red:   [{x: 0, y: 256}, {x: 256, y: 0}],
    green: [{x: 0, y: 256}, {x: 256, y: 0}],
    blue:  [{x: 0, y: 256}, {x: 256, y: 0}]
};

// Snapshot copy for absolute rollbacks on user discards
let fallbackChannelPoints = null;

let activeDragPointIndex = null;
let gridCanvasCtx = null;

/**
 * Bootstraps the core rendering properties for the curves canvas wrapper
 */
function initCurvesEngine() {
    const canvas = document.getElementById('curvesGridCanvas');
    if (canvas) gridCanvasCtx = canvas.getContext('2d');

    // Create deep snapshot fallback states on first initialize
    if (!fallbackChannelPoints) {
        fallbackChannelPoints = JSON.parse(JSON.stringify(channelPoints));
    }

    setupSvgMouseListeners();
    updateCurvesUI();
}

/**
 * Re-draws the entire UI workspace state (Canvas metrics grid, paths, and point highlights)
 */
function updateCurvesUI() {
    drawBackgroundGridAndMetrics();
    renderSplinePathAndNodes();
}

/**
 * Renders standard dark background grid partitions on the 2D canvas context
 */
function drawBackgroundGridAndMetrics() {
    if (!gridCanvasCtx) return;
    
    gridCanvasCtx.clearRect(0, 0, 256, 256);
    gridCanvasCtx.strokeStyle = '#2d2d2d';
    gridCanvasCtx.lineWidth = 1;

    // Build a clean 4x4 matrix mesh block grid layout
    const step = 256 / 4;
    for (let i = 1; i < 4; i++) {
        // Vertical lines mapping inputs
        gridCanvasCtx.beginPath();
        gridCanvasCtx.moveTo(i * step, 0);
        gridCanvasCtx.lineTo(i * step, 256);
        gridCanvasCtx.stroke();

        // Horizontal lines mapping outputs
        gridCanvasCtx.beginPath();
        gridCanvasCtx.moveTo(0, i * step);
        gridCanvasCtx.lineTo(256, i * step);
        gridCanvasCtx.stroke();
    }
}

/**
 * Computes Monotone Cubic Spline arrays and renders them into the SVG container
 */
function renderSplinePathAndNodes() {
    const channel = CurvesEditor.activeChannel;
    const points = channelPoints[channel];
    const pathEl = document.getElementById('curveSplinePath');
    const nodesGroup = document.getElementById('curvesPointsGroup');

    if (!pathEl || !nodesGroup) return;

    // --- Step 1: Compute Spline Segments ---
    let pathData = "";
    if (points.length === 2) {
        // Straight line fallback optimization rule
        pathData = `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
    } else {
        // Monotone Catmull-Rom or Cubic Spline approximations
        pathData = `M ${points[0].x} ${points[0].y}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(i - 1, 0)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(i + 2, points.length - 1)];

            // Quadratic/Cubic tangent layout estimations
            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;

            pathData += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
        }
    }

    // Set line trace path vectors 
    pathEl.setAttribute('d', pathData);

    // Apply color accents corresponding to active workspace channels
    let themeColor = "#00adb5"; // Default RGB
    if (channel === 'red') themeColor = "#ff4d4d";
    else if (channel === 'green') themeColor = "#4dff4d";
    else if (channel === 'blue') themeColor = "#4d4dff";
    pathEl.setAttribute('stroke', themeColor);

    // --- Step 2: Render Interactive SVG Drag Nodes ---
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

    // Compute Look-Up Table profile maps arrays for canvas core pipelines
    generateCurvesLUT(channel, points);
}

/**
 * Handles mouse operations and point drag tracks inside the coordinate plane window
 */
function setupSvgMouseListeners() {
    const svg = document.getElementById('curvesInteractiveSvg');
    const inputReadout = document.getElementById('curveInputVal');
    const outputReadout = document.getElementById('curveOutputVal');

    if (!svg) return;

    function getMouseCoords(e) {
        const rect = svg.getBoundingClientRect();
        let x = Math.round(e.clientX - rect.left);
        let y = Math.round(e.clientY - rect.top);
        return {
            x: Math.max(0, Math.min(256, x)),
            y: Math.max(0, Math.min(256, y))
        };
    }

    svg.addEventListener('mousedown', (e) => {
        const coords = getMouseCoords(e);
        const channel = CurvesEditor.activeChannel;
        const points = channelPoints[channel];

        // Readout update mapping inverted coordinates
        inputReadout.textContent = coords.x;
        outputReadout.textContent = 256 - coords.y;

        // Check if cursor clicked directly onto an existing vector dot point
        if (e.target.classList.contains('svg-curve-node')) {
            activeDragPointIndex = parseInt(e.target.getAttribute('data-index'));
            e.target.classList.add('active-node');
            return;
        }

        // Add a brand new node point if clicking empty curve lines space
        if (points.length < 10) { // Limit points safely to prevent chaotic splines
            // Inject points sequentially by maintaining X-axis monotonicity order
            let insertIdx = 0;
            while (insertIdx < points.length && points[insertIdx].x < coords.x) {
                insertIdx++;
            }
            points.splice(insertIdx, 0, coords);
            activeDragPointIndex = insertIdx;
            updateCurvesUI();
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (activeDragPointIndex === null) return;

        const coords = getMouseCoords(e);
        const channel = CurvesEditor.activeChannel;
        const points = channelPoints[channel];
        
        // Output textual value trackers updates
        inputReadout.textContent = coords.x;
        outputReadout.textContent = 256 - coords.y;

        // Boundaries checks to enforce strict sequence layout order constraints
        const leftLimit = (activeDragPointIndex === 0) ? 0 : points[activeDragPointIndex - 1].x + 2;
        const rightLimit = (activeDragPointIndex === points.length - 1) ? 256 : points[activeDragPointIndex + 1].x - 2;

        // Boundary handling constraints adjustments 
        let targetX = coords.x;
        if (activeDragPointIndex === 0) targetX = 0; // Fix edge nodes to absolute boundaries sides
        else if (activeDragPointIndex === points.length - 1) targetX = 256;
        else {
            targetX = Math.max(leftLimit, Math.min(rightLimit, targetX));
        }

        points[activeDragPointIndex].x = targetX;
        points[activeDragPointIndex].y = coords.y;

        updateCurvesUI();
        applyLiveCurvesFilterStub();
    });

    window.addEventListener('mouseup', () => {
        if (activeDragPointIndex !== null) {
            const activeNode = svg.querySelector('.active-node');
            if (activeNode) activeNode.classList.remove('active-node');
            activeDragPointIndex = null;
        }
    });
}

/**
 * Creates an 8-bit lookup table array tracking explicit curves output assignments
 */
function generateCurvesLUT(channel, points) {
    let lut = new Uint8Array(256);
    
    if (!points || points.length === 0) {
        for (let i = 0; i < 256; i++) lut[i] = i;
        CurvesEditor.curvesLUTs[channel] = lut;
        syncToPhotoEditorPipeline(); // Keep global objects mirrored
        return;
    }

    // 1. Map UI workspace coordinates (y=256 at bottom) to math engine space (y=0 at bottom)
    const normalizedPoints = points.map(pt => ({
        x: pt.x,
        y: 256 - pt.y
    }));

    // 2. Loop through every single lookup byte entry (0 to 255 input values)
    for (let i = 0; i < 256; i++) {
        const targetX = i;

        // Clamp values if they fall completely outside outer bounds edge targets
        if (targetX <= normalizedPoints[0].x) {
            lut[i] = Math.min(255, Math.max(0, Math.round((normalizedPoints[0].y / 256) * 255)));
            continue;
        }
        if (targetX >= normalizedPoints[normalizedPoints.length - 1].x) {
            lut[i] = Math.min(255, Math.max(0, Math.round((normalizedPoints[normalizedPoints.length - 1].y / 256) * 255)));
            continue;
        }

        // 3. Find the line segment interval our active pixel byte sits inside
        let idx = 0;
        while (idx < normalizedPoints.length - 1 && normalizedPoints[idx + 1].x < targetX) {
            idx++;
        }

        // 4. Match your exact UI rendering math parameters for seamless preview tracking
        const p1 = normalizedPoints[idx];
        const p2 = normalizedPoints[idx + 1];
        
        // Grab surrounding anchor indexes for matching tangent profiles
        const p0 = normalizedPoints[Math.max(idx - 1, 0)];
        const p3 = normalizedPoints[Math.min(idx + 2, normalizedPoints.length - 1)];

        // Normalized fractional interpolation step calculation (0.0 - 1.0)
        const t = (targetX - p1.x) / (p2.x - p1.x);
        const t2 = t * t;
        const t3 = t2 * t;

        // Catmull-Rom / Cubic Spline Hermite Basis blend matching your exact UI line layout
        const h1 = 2 * t3 - 3 * t2 + 1;
        const h2 = -2 * t3 + 3 * t2;
        const h3 = t3 - 2 * t2 + t;
        const h4 = t3 - t2;

        // Tangent computations derived directly from your line generation math loops
        const m1 = (p2.x - p0.x) === 0 ? 0 : (p2.y - p0.y) / 6;
        const m2 = (p3.x - p1.x) === 0 ? 0 : (p3.y - p1.y) / 6;

        const calculatedY = h1 * p1.y + h2 * p2.y + h3 * m1 + h4 * m2;
        
        // Convert back into an 8-bit image byte (0 - 255)
        lut[i] = Math.min(255, Math.max(0, Math.round((calculatedY / 256) * 255)));
    }
    
    // Save generated array into your local UI tracking state layer
    CurvesEditor.curvesLUTs[channel] = lut;

    // Map local LUTs directly over to photo_editor.js expectations
    syncToPhotoEditorPipeline();
}

/**
 * Bridges the local CurvesEditor state onto the window.CurvesManager pipeline architecture
 * without forcing mutations or logs on the global Master History Manager timeline stack.
 */
function syncToPhotoEditorPipeline() {
    // Fallbacks if LUT arrays haven't been compiled yet
    const masterLut = CurvesEditor.curvesLUTs.rgb   || Array.from({length: 256}, (_, i) => i);
    const redLut    = CurvesEditor.curvesLUTs.red   || Array.from({length: 256}, (_, i) => i);
    const greenLut  = CurvesEditor.curvesLUTs.green || Array.from({length: 256}, (_, i) => i);
    const blueLut   = CurvesEditor.curvesLUTs.blue  || Array.from({length: 256}, (_, i) => i);

    // Initialize global object window mapping expected by photo_editor.js
    window.CurvesManager = {
        activeState: {
            active: true,
            // Compounding the Master RGB channel lookup into individual color channels
            lutR: new Uint8Array(256).map((_, i) => redLut[masterLut[i]]),
            lutG: new Uint8Array(256).map((_, i) => greenLut[masterLut[i]]),
            lutB: new Uint8Array(256).map((_, i) => blueLut[masterLut[i]])
        }
    };
}

/**
 * Resets points dataset across active color configurations
 */
function resetCurrentChannel() {
    const channel = CurvesEditor.activeChannel;
    channelPoints[channel] = [{x: 0, y: 256}, {x: 256, y: 0}];
    updateCurvesUI();
    applyLiveCurvesFilterStub();
}

/**
 * Restores original parameters on clean cancellation discards
 */
function discardCurvesEngineChanges() {
    if (fallbackChannelPoints) {
        channelPoints = JSON.parse(JSON.stringify(fallbackChannelPoints));
    }
}

/**
 * Interactive pipeline hook tracking slider shifts matching your standard details processors
*/
function applyLiveCurvesFilterStub() {
    // Fires the shared window event listener that tells photo_editor.js to update the main canvas view
    window.dispatchEvent(new CustomEvent('editorHistoryChanged'));
}
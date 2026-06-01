const STORAGE_KEY = 'simple-notebook-state-v2';
const canvas = document.getElementById('board');
const context = canvas.getContext('2d');
const palette = document.getElementById('palette');
const brushSize = document.getElementById('brushSize');
const penMode = document.getElementById('penMode');
const eraserMode = document.getElementById('eraserMode');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const beautifyBtn = document.getElementById('beautifyBtn');
const saveBtn = document.getElementById('saveBtn');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');
const statusLine = document.getElementById('statusLine');

const state = {
  mode: 'pen',
  color: '#1f2937',
  size: Number(brushSize.value),
  strokes: [],
  redoStack: [],
  isDrawing: false,
  activeStroke: null,
  activePointerId: null,
  renderToken: 0,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function now() {
  return performance.now();
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    pressure: ((a.pressure ?? 0.5) + (b.pressure ?? 0.5)) / 2,
    time: ((a.time ?? 0) + (b.time ?? 0)) / 2,
  };
}

function clonePoint(point) {
  return {
    x: point.x,
    y: point.y,
    pressure: point.pressure ?? 0.5,
    time: point.time ?? 0,
  };
}

function cloneStroke(stroke) {
  return {
    mode: stroke.mode,
    color: stroke.color,
    size: stroke.size,
    beautified: Boolean(stroke.beautified),
    points: stroke.points.map(clonePoint),
  };
}

function setStatus(message) {
  statusLine.textContent = message;
  clearTimeout(state.statusTimer);
  state.statusTimer = setTimeout(() => {
    statusLine.textContent = 'Autosaves locally in this browser.';
  }, 1600);
}

function getCanvasMetrics() {
  const rect = canvas.getBoundingClientRect();
  return {
    width: rect.width,
    height: rect.height,
    ratio: window.devicePixelRatio || 1,
  };
}

function normalizePoints(points, passes) {
  if (points.length <= 2) {
    return points.map(clonePoint);
  }

  let result = points.map(clonePoint);

  for (let pass = 0; pass < passes; pass += 1) {
    const next = [result[0]];

    for (let index = 1; index < result.length - 1; index += 1) {
      const previous = result[index - 1];
      const current = result[index];
      const nextPoint = result[index + 1];

      next.push({
        x: previous.x * 0.2 + current.x * 0.6 + nextPoint.x * 0.2,
        y: previous.y * 0.2 + current.y * 0.6 + nextPoint.y * 0.2,
        pressure: clamp(previous.pressure * 0.2 + current.pressure * 0.6 + nextPoint.pressure * 0.2, 0.08, 1),
        time: current.time,
      });
    }

    next.push(result[result.length - 1]);
    result = next;
  }

  return result;
}

function averagePressure(points) {
  if (!points.length) return 0.5;
  const total = points.reduce((sum, point) => sum + (point.pressure ?? 0.5), 0);
  return total / points.length;
}

function renderPaperBackground(targetContext, width, height) {
  targetContext.save();
  targetContext.fillStyle = '#fffdf7';
  targetContext.fillRect(0, 0, width, height);

  targetContext.fillStyle = '#fbf7ee';
  targetContext.fillRect(0, 0, width, height);

  targetContext.fillStyle = 'rgba(183, 58, 58, 0.14)';
  targetContext.fillRect(70, 0, 1.25, height);

  targetContext.strokeStyle = 'rgba(63, 98, 148, 0.12)';
  targetContext.lineWidth = 1;

  for (let lineY = 31; lineY < height; lineY += 32) {
    targetContext.beginPath();
    targetContext.moveTo(0, lineY + 0.5);
    targetContext.lineTo(width, lineY + 0.5);
    targetContext.stroke();
  }

  targetContext.restore();
}

function renderStroke(stroke, targetContext = context) {
  const points = normalizePoints(stroke.points, stroke.beautified ? 2 : 1);
  if (!points.length) return;

  targetContext.save();
  targetContext.globalCompositeOperation = stroke.mode === 'eraser' ? 'destination-out' : 'source-over';
  targetContext.lineCap = 'round';
  targetContext.lineJoin = 'round';
  targetContext.strokeStyle = stroke.color;
  targetContext.fillStyle = stroke.color;

  const baseWidth = stroke.mode === 'eraser' ? stroke.size * 2.5 : stroke.size;
  const width = clamp(baseWidth * (0.82 + averagePressure(points) * 0.5), 1, 52);
  targetContext.lineWidth = width;

  if (points.length === 1) {
    const point = points[0];
    targetContext.beginPath();
    targetContext.arc(point.x, point.y, width / 2, 0, Math.PI * 2);
    targetContext.fill();
    targetContext.restore();
    return;
  }

  if (points.length === 2) {
    targetContext.beginPath();
    targetContext.moveTo(points[0].x, points[0].y);
    targetContext.lineTo(points[1].x, points[1].y);
    targetContext.stroke();
    targetContext.restore();
    return;
  }

  targetContext.beginPath();
  targetContext.moveTo(points[0].x, points[0].y);

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const nextPoint = points[index + 1];
    const mid = midpoint(current, nextPoint);
    targetContext.quadraticCurveTo(current.x, current.y, mid.x, mid.y);
  }

  const lastPoint = points[points.length - 1];
  targetContext.lineTo(lastPoint.x, lastPoint.y);
  targetContext.stroke();
  targetContext.restore();
}

function redraw() {
  const { width, height, ratio } = getCanvasMetrics();
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  for (const stroke of state.strokes) {
    renderStroke(stroke);
  }
  if (state.activeStroke) {
    renderStroke(state.activeStroke);
  }
}

function resizeCanvas() {
  const { width, height, ratio } = getCanvasMetrics();
  const scaledWidth = Math.max(1, Math.floor(width * ratio));
  const scaledHeight = Math.max(1, Math.floor(height * ratio));

  if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
  }

  redraw();
}

function persistState() {
  const payload = {
    color: state.color,
    size: state.size,
    mode: state.mode,
    strokes: state.strokes,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const data = JSON.parse(raw);
    if (Array.isArray(data.strokes)) {
      state.strokes = data.strokes.map(cloneStroke);
    }
    if (typeof data.color === 'string') {
      state.color = data.color;
    }
    if (typeof data.size === 'number') {
      state.size = data.size;
      brushSize.value = String(data.size);
    }
    if (typeof data.mode === 'string' && (data.mode === 'pen' || data.mode === 'eraser')) {
      state.mode = data.mode;
    }
  } catch {
    // Ignore invalid saved data and start fresh.
  }
}

function updateToolState() {
  penMode.classList.toggle('is-active', state.mode === 'pen');
  eraserMode.classList.toggle('is-active', state.mode === 'eraser');
  palette.querySelectorAll('.swatch').forEach((swatch) => {
    swatch.classList.toggle('active', swatch.dataset.color === state.color);
  });
}

function setMode(mode) {
  state.mode = mode;
  updateToolState();
}

function getPointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const pressure = event.pressure && event.pressure > 0 ? event.pressure : event.pointerType === 'pen' ? 0.55 : 0.5;

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    pressure,
    time: now(),
  };
}

function shouldStorePoint(previous, next) {
  if (!previous) return true;
  const minimumDistance = Math.max(0.55, state.size * 0.08);
  return distance(previous, next) >= minimumDistance;
}

function startStroke(event) {
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  state.isDrawing = true;
  state.activePointerId = event.pointerId;
  state.redoStack = [];

  state.activeStroke = {
    mode: state.mode,
    color: state.mode === 'eraser' ? '#ffffff' : state.color,
    size: state.size,
    beautified: false,
    points: [getPointFromEvent(event)],
  };

  redraw();
}

function extendStroke(event) {
  if (!state.isDrawing || state.activePointerId !== event.pointerId || !state.activeStroke) {
    return;
  }

  event.preventDefault();
  const point = getPointFromEvent(event);
  const points = state.activeStroke.points;
  const lastPoint = points[points.length - 1];

  if (shouldStorePoint(lastPoint, point)) {
    points.push(point);
  } else {
    points[points.length - 1] = point;
  }

  redraw();
}

function finishStroke(event) {
  if (!state.isDrawing || state.activePointerId !== event.pointerId) return;

  if (state.activeStroke && state.activeStroke.points.length) {
    state.strokes.push(state.activeStroke);
    state.activeStroke = null;
    persistState();
  }

  state.isDrawing = false;
  state.activePointerId = null;
  redraw();
}

function beautifyStroke(stroke) {
  if (stroke.mode !== 'pen' || stroke.points.length < 2) {
    return cloneStroke(stroke);
  }

  return {
    ...cloneStroke(stroke),
    beautified: true,
    points: normalizePoints(stroke.points, 3),
  };
}

function beautifyWriting() {
  state.strokes = state.strokes.map(beautifyStroke);
  state.redoStack = [];
  persistState();
  redraw();
  setStatus('Creamy Handwriting applied.');
}

function exportCanvas() {
  const exportWidth = Math.max(1, Math.floor(canvas.clientWidth));
  const exportHeight = Math.max(1, Math.floor(canvas.clientHeight));
  const exportCanvasElement = document.createElement('canvas');
  exportCanvasElement.width = exportWidth;
  exportCanvasElement.height = exportHeight;

  const exportContext = exportCanvasElement.getContext('2d');
  renderPaperBackground(exportContext, exportWidth, exportHeight);
  for (const stroke of state.strokes) {
    renderStroke(stroke, exportContext);
  }

  const link = document.createElement('a');
  link.href = exportCanvasElement.toDataURL('image/png');
  link.download = 'notebook-page.png';
  link.click();
  setStatus('PNG exported.');
}

function saveNotebook() {
  persistState();
  setStatus('Notebook saved locally.');
}

function undoStroke() {
  const stroke = state.strokes.pop();
  if (!stroke) return;
  state.redoStack.push(stroke);
  persistState();
  redraw();
  setStatus('Stroke undone.');
}

function redoStroke() {
  const stroke = state.redoStack.pop();
  if (!stroke) return;
  state.strokes.push(stroke);
  persistState();
  redraw();
  setStatus('Stroke restored.');
}

function clearNotebook() {
  const shouldClear = window.confirm('Clear the whole page? This will remove every stroke on the notebook.');
  if (!shouldClear) return;
  state.strokes = [];
  state.redoStack = [];
  state.activeStroke = null;
  persistState();
  redraw();
  setStatus('Notebook cleared.');
}

palette.addEventListener('click', (event) => {
  const button = event.target.closest('.swatch');
  if (!button) return;
  state.color = button.dataset.color;
  state.mode = 'pen';
  updateToolState();
  persistState();
});

brushSize.addEventListener('input', (event) => {
  state.size = Number(event.target.value);
  persistState();
});

penMode.addEventListener('click', () => setMode('pen'));
eraserMode.addEventListener('click', () => setMode('eraser'));
undoBtn.addEventListener('click', undoStroke);
redoBtn.addEventListener('click', redoStroke);
beautifyBtn.addEventListener('click', beautifyWriting);
saveBtn.addEventListener('click', saveNotebook);
exportBtn.addEventListener('click', exportCanvas);
clearBtn.addEventListener('click', clearNotebook);

canvas.addEventListener('pointerdown', startStroke);
canvas.addEventListener('pointermove', extendStroke);
canvas.addEventListener('pointerup', finishStroke);
canvas.addEventListener('pointercancel', finishStroke);
canvas.addEventListener('lostpointercapture', finishStroke);
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
window.addEventListener('resize', resizeCanvas);

if ('ResizeObserver' in window) {
  const observer = new ResizeObserver(() => resizeCanvas());
  observer.observe(canvas.parentElement);
}

loadState();
updateToolState();
resizeCanvas();
setMode(state.mode === 'eraser' ? 'eraser' : 'pen');
setStatus(state.strokes.length ? 'Notebook loaded from local storage.' : 'Autosaves locally in this browser.');

// Future AI hooks:
// - Replace beautifyWriting() with a handwriting beautification model.
// - Add handwriting recognition for searchable notes.
// - Learn the user’s personal writing style and recreate it cleanly.
// - Transform rough stroke input into a personalized clean handwriting pass.

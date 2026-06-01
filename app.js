const STORAGE_KEY = "simple-notebook-workspace-v1";
const THEME_KEY = "simple-notebook-theme-v1";


const INK_COLORS = ["#1d4ed8", "#ec4899", "#38bdf8", "#f97316", "#111827"];

const INK_ENGINE = {
  liveDelayMs: 18,
  liveSmoothingPasses: 1,
  refineSmoothingPasses: 4,
  minPointDistance: 0.65,
  lineStraightenStrength: 0.32,
  curveSmoothStrength: 0.18,
  maxRowShift: 8,
};

const PALETTES = [
  { id: "soft-pastel", name: "Soft Pastel", bg: "#fffaf0", line: "rgba(103, 139, 196, 0.14)", margin: "rgba(240, 174, 196, 0.16)", border: "rgba(141, 153, 182, 0.18)", shadow: "0 16px 40px rgba(31, 41, 55, 0.08)", texture: "rgba(255,255,255,0.34)" },
  { id: "warm-coffee", name: "Warm Coffee", bg: "#f8efe1", line: "rgba(114, 85, 55, 0.16)", margin: "rgba(146, 98, 55, 0.18)", border: "rgba(125, 93, 63, 0.2)", shadow: "0 16px 40px rgba(74, 54, 38, 0.12)", texture: "rgba(255,255,255,0.24)" },
  { id: "dark-academic", name: "Dark Academic", bg: "#1a1f2a", line: "rgba(180, 190, 205, 0.16)", margin: "rgba(98, 112, 129, 0.24)", border: "rgba(128, 140, 157, 0.2)", shadow: "0 16px 42px rgba(3, 7, 18, 0.42)", texture: "rgba(255,255,255,0.05)" },
  { id: "forest-night", name: "Forest Night", bg: "#102018", line: "rgba(164, 201, 164, 0.16)", margin: "rgba(86, 119, 86, 0.18)", border: "rgba(112, 140, 112, 0.2)", shadow: "0 16px 42px rgba(4, 10, 7, 0.36)", texture: "rgba(255,255,255,0.06)" },
  { id: "ocean-study", name: "Ocean Study", bg: "#eef7ff", line: "rgba(94, 126, 166, 0.16)", margin: "rgba(121, 170, 214, 0.18)", border: "rgba(118, 149, 183, 0.2)", shadow: "0 16px 40px rgba(30, 58, 90, 0.1)", texture: "rgba(255,255,255,0.32)" },
  { id: "minimal-black", name: "Minimal Black", bg: "#0d1117", line: "rgba(210, 215, 224, 0.16)", margin: "rgba(120, 128, 138, 0.22)", border: "rgba(137, 146, 158, 0.22)", shadow: "0 16px 42px rgba(0, 0, 0, 0.46)", texture: "rgba(255,255,255,0.04)" },
];

const DOM = {
  appShell: document.getElementById("appShell"),
  sidebar: document.getElementById("sidebar"),
  scrim: document.getElementById("scrim"),
  sidebarToggle: document.getElementById("sidebarToggle"),
  newProjectBtn: document.getElementById("newProjectBtn"),
  newPageBtn: document.getElementById("newPageBtn"),
  projectList: document.getElementById("projectList"),
  paletteList: document.getElementById("paletteList"),
  projectTitle: document.getElementById("projectTitle"),
  pageTitle: document.getElementById("pageTitle"),
  colorSwatches: document.getElementById("colorSwatches"),
  brushSize: document.getElementById("brushSize"),
  paperFrame: document.querySelector(".paper-frame"),
  penBtn: document.getElementById("penBtn"),
  eraserBtn: document.getElementById("eraserBtn"),
  undoBtn: document.getElementById("undoBtn"),
  redoBtn: document.getElementById("redoBtn"),
  beautifyBtn: document.getElementById("beautifyBtn"),
  saveBtn: document.getElementById("saveBtn"),
  themeToggle: document.getElementById("themeToggle"),
  exportMenu: document.getElementById("exportMenu"),
  exportBtn: document.getElementById("exportBtn"),
  clearBtn: document.getElementById("clearBtn"),
  board: document.getElementById("board"),
  status: document.getElementById("status"),
};

const context = DOM.board.getContext("2d");

const state = {
  projects: [],
  selectedProjectId: null,
  selectedPageId: null,
  selectedPaletteId: "soft-pastel",
  selectedColor: INK_COLORS[0],
  brushSize: 4,
  mode: "pen",
  sidebarOpen: true,
  theme: "light",
  exportMenuOpen: false,
  menu: null,
  isDrawing: false,
  activePointerId: null,
  activeStroke: null,
  saveTimer: null,
  statusTimer: null,
  renderQueued: false,
};

function uid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
  const rawPoints = Array.isArray(stroke.rawPoints)
    ? stroke.rawPoints.map(clonePoint)
    : Array.isArray(stroke.points)
      ? stroke.points.map(clonePoint)
      : [];

  return {
    mode: stroke.mode === "eraser" ? "eraser" : "pen",
    color: stroke.color,
    size: Number(stroke.size) || 4,
    beautified: Boolean(stroke.beautified),
    rawPoints,
    points: Array.isArray(stroke.points) ? stroke.points.map(clonePoint) : rawPoints.map(clonePoint),
  };
}

function createDefaultPage(name = "Page 1") {
  return {
    id: uid("page"),
    name,
    themeId: "soft-pastel",
    strokes: [],
    redoStack: [],
  };
}

function createDefaultProject(name = "Notebook 1") {
  const page = createDefaultPage();
  return {
    id: uid("project"),
    name,
    expanded: true,
    pages: [page],
  };
}

function getPalette(id) {
  return PALETTES.find((palette) => palette.id === id) || PALETTES[0];
}

function getSelectedProject() {
  return state.projects.find((project) => project.id === state.selectedProjectId) || state.projects[0] || null;
}

function getSelectedPage() {
  const project = getSelectedProject();
  if (!project) return null;
  return project.pages.find((page) => page.id === state.selectedPageId) || project.pages[0] || null;
}

function ensureWorkspace() {
  if (!state.projects.length) {
    state.projects = [createDefaultProject()];
  }

  for (const project of state.projects) {
    if (!Array.isArray(project.pages) || !project.pages.length) {
      project.pages = [createDefaultPage()];
    }
    project.expanded = Boolean(project.expanded);
    for (const page of project.pages) {
      page.themeId = PALETTES.some((palette) => palette.id === page.themeId) ? page.themeId : "soft-pastel";
      page.strokes = Array.isArray(page.strokes) ? page.strokes : [];
      page.redoStack = Array.isArray(page.redoStack) ? page.redoStack : [];
    }
  }

  if (!state.projects.some((project) => project.id === state.selectedProjectId)) {
    state.selectedProjectId = state.projects[0].id;
  }

  const project = getSelectedProject();
  if (!project.pages.some((page) => page.id === state.selectedPageId)) {
    state.selectedPageId = project.pages[0].id;
  }

  if (!PALETTES.some((palette) => palette.id === state.selectedPaletteId)) {
    state.selectedPaletteId = getSelectedPage()?.themeId || PALETTES[0].id;
  }

  if (!INK_COLORS.includes(state.selectedColor)) {
    state.selectedColor = INK_COLORS[0];
  }

  state.brushSize = Number(state.brushSize) || 4;
  state.mode = state.mode === "eraser" ? "eraser" : "pen";
}

function serializeWorkspace() {
  return {
    projects: state.projects,
    selectedProjectId: state.selectedProjectId,
    selectedPageId: state.selectedPageId,
    selectedPaletteId: state.selectedPaletteId,
    selectedColor: state.selectedColor,
    brushSize: state.brushSize,
    mode: state.mode,
    sidebarOpen: state.sidebarOpen,
    theme: state.theme,
  };
}

function saveNow() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeWorkspace()));
}

function scheduleSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    saveNow();
  }, 120);
}

function setStatus(message) {
  DOM.status.textContent = message;
  clearTimeout(state.statusTimer);
  state.statusTimer = setTimeout(() => {
    DOM.status.textContent = "Autosaves locally in this browser.";
  }, 1800);
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  localStorage.setItem(THEME_KEY, state.theme);
  if (DOM.themeToggle) {
    DOM.themeToggle.textContent = state.theme === "dark" ? "☀️ Light" : "🌙 Dark";
    DOM.themeToggle.setAttribute("aria-label", `Switch to ${state.theme === "dark" ? "light" : "dark"} mode`);
  }
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme();
  scheduleSave();
  setStatus(`${state.theme === "dark" ? "Dark" : "Light"} mode enabled.`);
}

function getEmojiForId(id, fallback = "✨") {
  const emojis = ["😊", "🎨", "📚", "🚀", "💡", "✨", "🌙", "📝", "🧠", "🌿"];
  let sum = 0;
  for (const char of String(id || fallback)) sum += char.charCodeAt(0);
  return emojis[sum % emojis.length];
}

function loadWorkspace() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      state.projects = [createDefaultProject()];
      state.selectedProjectId = state.projects[0].id;
      state.selectedPageId = state.projects[0].pages[0].id;
      state.theme = localStorage.getItem(THEME_KEY) || "light";
      return;
    }

    const parsed = JSON.parse(raw);
    state.projects = Array.isArray(parsed.projects) ? parsed.projects : [];
    state.selectedProjectId = parsed.selectedProjectId || null;
    state.selectedPageId = parsed.selectedPageId || null;
    state.selectedPaletteId = parsed.selectedPaletteId || state.selectedPaletteId;
    state.selectedColor = parsed.selectedColor || state.selectedColor;
    state.brushSize = Number(parsed.brushSize) || state.brushSize;
    state.mode = parsed.mode === "eraser" ? "eraser" : "pen";
    state.sidebarOpen = typeof parsed.sidebarOpen === "boolean" ? parsed.sidebarOpen : window.innerWidth > 980;
    state.theme = parsed.theme || localStorage.getItem(THEME_KEY) || "light";
  } catch {
    state.projects = [createDefaultProject()];
    state.selectedProjectId = state.projects[0].id;
    state.selectedPageId = state.projects[0].pages[0].id;
    state.sidebarOpen = window.innerWidth > 980;
    state.theme = localStorage.getItem(THEME_KEY) || "light";
  }

  state.theme = state.theme === "dark" ? "dark" : "light";
  ensureWorkspace();
}

function getCurrentPalette() {
  return getPalette(state.selectedPaletteId);
}

function applyPaperTheme(themeId) {
  const palette = getPalette(themeId || state.selectedPaletteId);

  DOM.paperFrame.style.setProperty("--paper-bg", palette.bg);
  DOM.paperFrame.style.setProperty("--paper-line", palette.line);
  DOM.paperFrame.style.setProperty("--paper-margin", palette.margin);
  DOM.paperFrame.style.setProperty("--paper-border", palette.border);
  DOM.paperFrame.style.setProperty("--paper-shadow", palette.shadow);
  DOM.paperFrame.style.setProperty("--paper-texture", palette.texture);
}

function setActivePalette(id) {
  const page = getSelectedPage();
  if (!page) return;

  state.selectedPaletteId = id;
  page.themeId = id;

  applyPaperTheme(id);
  scheduleSave();
  renderPalettePicker();
  setStatus("Notebook theme changed.");
}

function setSelectedColor(color) {
  state.selectedColor = color;
  scheduleSave();
  renderAll();
}

function setMode(mode) {
  state.mode = mode === "eraser" ? "eraser" : "pen";
  scheduleSave();
  renderAll();
}

function selectProject(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  state.selectedProjectId = projectId;
  state.selectedPageId = project.pages[0]?.id || null;
  project.expanded = true;
  state.menu = null;
  scheduleSave();
  renderAll();
}

function selectPage(projectId, pageId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  const page = project.pages.find((item) => item.id === pageId);
  if (!page) return;
 state.selectedProjectId = projectId;
state.selectedPageId = pageId;
state.selectedPaletteId = page.themeId || state.selectedPaletteId;
project.expanded = true;
state.menu = null;
scheduleSave();
renderAll();
}

function createProject() {
  const existingNames = new Set(state.projects.map((project) => project.name));
  let index = 1;
  let name = `Project ${index}`;
  while (existingNames.has(name)) {
    index += 1;
    name = `Project ${index}`;
  }
  const project = createDefaultProject(name);
  state.projects.push(project);
  state.projects.forEach((item) => {
    item.expanded = item.id === project.id;
  });
  state.selectedProjectId = project.id;
  state.selectedPageId = project.pages[0].id;
  state.menu = null;
  scheduleSave();
  renderAll();
  setStatus("New project created.");
}

function createPage(projectId = state.selectedProjectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  const existingNames = new Set(project.pages.map((page) => page.name));
  let index = 1;
  let name = `Page ${index}`;
  while (existingNames.has(name)) {
    index += 1;
    name = `Page ${index}`;
  }
  const page = createDefaultPage(name);
  project.pages.push(page);
  project.expanded = true;
  state.selectedProjectId = project.id;
  state.selectedPageId = page.id;
  state.menu = null;
  scheduleSave();
  renderAll();
  setStatus("New page added.");
}

function renameProject(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  const nextName = window.prompt("Rename project", project.name);
  if (!nextName) return;
  project.name = nextName.trim();
  if (!project.name) project.name = "Untitled Project";
  state.menu = null;
  scheduleSave();
  renderAll();
}

function renamePage(projectId, pageId) {
  const project = state.projects.find((item) => item.id === projectId);
  const page = project?.pages.find((item) => item.id === pageId);
  if (!project || !page) return;
  const nextName = window.prompt("Rename page", page.name);
  if (!nextName) return;
  page.name = nextName.trim();
  if (!page.name) page.name = "Untitled Page";
  state.menu = null;
  scheduleSave();
  renderAll();
}

function deleteProject(projectId) {
  if (state.projects.length === 1) {
    const shouldReplace = window.confirm("This is the last project. Delete it and create a fresh one?");
    if (!shouldReplace) return;
    state.projects = [createDefaultProject()];
    state.selectedProjectId = state.projects[0].id;
    state.selectedPageId = state.projects[0].pages[0].id;
  } else {
    const project = state.projects.find((item) => item.id === projectId);
    if (!project) return;
    const shouldDelete = window.confirm(`Delete project \"${project.name}\"? This removes all its pages and drawings.`);
    if (!shouldDelete) return;
    state.projects = state.projects.filter((item) => item.id !== projectId);
    const nextProject = state.projects[0];
    state.selectedProjectId = nextProject.id;
    state.selectedPageId = nextProject.pages[0].id;
    nextProject.expanded = true;
  }
  state.menu = null;
  ensureWorkspace();
  scheduleSave();
  renderAll();
  setStatus("Project deleted.");
}

function deletePage(projectId, pageId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  const page = project.pages.find((item) => item.id === pageId);
  if (!page) return;
  const shouldDelete = window.confirm(`Delete page \"${page.name}\"?`);
  if (!shouldDelete) return;
  project.pages = project.pages.filter((item) => item.id !== pageId);
  if (!project.pages.length) {
    project.pages.push(createDefaultPage());
  }
  state.selectedProjectId = project.id;
  state.selectedPageId = project.pages[0].id;
  project.expanded = true;
  state.menu = null;
  ensureWorkspace();
  scheduleSave();
  renderAll();
  setStatus("Page deleted.");
}

function toggleProjectOpen(projectId) {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return;
  project.expanded = !project.expanded;
  state.menu = null;
  scheduleSave();
  renderAll();
}

function toggleSidebar(force) {
  state.sidebarOpen = typeof force === "boolean" ? force : !state.sidebarOpen;
  scheduleSave();
  renderAll();
}

function closeMenus() {
  state.menu = null;
  renderAllSidebar();
}

function setCanvasTransformToCssPixels() {
  const ratio = window.devicePixelRatio || 1;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ratio;
}

function getCanvasSize() {
  const rect = DOM.board.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  return {
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
    ratio,
  };
}

function resizeCanvas() {
  const { width, height, ratio } = getCanvasSize();
  const targetWidth = Math.floor(width * ratio);
  const targetHeight = Math.floor(height * ratio);
  if (DOM.board.width !== targetWidth || DOM.board.height !== targetHeight) {
    DOM.board.width = targetWidth;
    DOM.board.height = targetHeight;
  }
  renderCanvas();
}

function getCurrentPage() {
  return getSelectedPage();
}

function shouldStorePoint(previous, nextPoint, minimumDistance = INK_ENGINE.minPointDistance) {
  if (!previous) return true;
  return Math.hypot(nextPoint.x - previous.x, nextPoint.y - previous.y) >= Math.max(minimumDistance, state.brushSize * 0.06);
}

function getStrokePoints(stroke) {
  if (Array.isArray(stroke.points) && stroke.points.length) return stroke.points;
  if (Array.isArray(stroke.rawPoints) && stroke.rawPoints.length) return stroke.rawPoints;
  return [];
}

function smoothPoints(points, passes = 1) {
  if (points.length <= 2) return points.map(clonePoint);
  let current = points.map(clonePoint);
  for (let pass = 0; pass < passes; pass += 1) {
    const next = [current[0]];
    for (let index = 1; index < current.length - 1; index += 1) {
      const previous = current[index - 1];
      const point = current[index];
      const after = current[index + 1];
      next.push({
        x: previous.x * 0.18 + point.x * 0.64 + after.x * 0.18,
        y: previous.y * 0.18 + point.y * 0.64 + after.y * 0.18,
        pressure: previous.pressure * 0.18 + point.pressure * 0.64 + after.pressure * 0.18,
        time: point.time,
      });
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
}

function simplifyClosePoints(points, minimumDistance = 0.8) {
  if (points.length <= 2) return points.map(clonePoint);
  const simplified = [clonePoint(points[0])];
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const previous = simplified[simplified.length - 1];
    if (Math.hypot(point.x - previous.x, point.y - previous.y) >= minimumDistance) {
      simplified.push(clonePoint(point));
    }
  }
  simplified.push(clonePoint(points[points.length - 1]));
  return simplified;
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function distancePointToLine(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (!lengthSq) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq));
  const projection = { x: start.x + t * dx, y: start.y + t * dy };
  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

function straightenIfAlmostLine(points, strength = INK_ENGINE.lineStraightenStrength) {
  if (points.length < 4) return points.map(clonePoint);
  const start = points[0];
  const end = points[points.length - 1];
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length < 18) return points.map(clonePoint);

  const totalTravel = points.slice(1).reduce((sum, point, index) => {
    const previous = points[index];
    return sum + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
  const directness = length / Math.max(totalTravel, 1);
  const averageWobble = points.reduce((sum, point) => sum + distancePointToLine(point, start, end), 0) / points.length;

  if (directness < 0.72 || averageWobble > Math.max(7, length * 0.055)) {
    return points.map(clonePoint);
  }

  return points.map((point, index) => {
    const t = index / Math.max(points.length - 1, 1);
    const lineX = lerp(start.x, end.x, t);
    const lineY = lerp(start.y, end.y, t);
    return {
      ...point,
      x: lerp(point.x, lineX, strength),
      y: lerp(point.y, lineY, strength),
    };
  });
}

function getPointWidth(point, previous, baseWidth, mode) {
  const pressure = point.pressure ?? 0.5;
  const dt = Math.max(8, (point.time ?? 0) - (previous?.time ?? point.time ?? 0));
  const distance = previous ? Math.hypot(point.x - previous.x, point.y - previous.y) : 0;
  const speed = distance / dt;
  const speedFactor = mode === "eraser" ? 1 : Math.max(0.72, Math.min(1.18, 1.08 - speed * 0.42));
  const pressureFactor = mode === "eraser" ? 1 : 0.74 + pressure * 0.58;
  return Math.max(0.85, baseWidth * speedFactor * pressureFactor);
}

function renderStroke(stroke, targetContext = context) {
  const sourcePoints = getStrokePoints(stroke);
  const passes = stroke.beautified ? 2 : INK_ENGINE.liveSmoothingPasses;
  const points = simplifyClosePoints(smoothPoints(sourcePoints, passes), 0.55);
  if (!points.length) return;

  targetContext.save();
  targetContext.globalCompositeOperation = stroke.mode === "eraser" ? "destination-out" : "source-over";
  targetContext.lineCap = "round";
  targetContext.lineJoin = "round";
  targetContext.strokeStyle = stroke.color;
  targetContext.fillStyle = stroke.color;

  const baseWidth = stroke.mode === "eraser" ? stroke.size * 2.4 : stroke.size;

  if (points.length === 1) {
    const point = points[0];
    const width = getPointWidth(point, null, baseWidth, stroke.mode);
    targetContext.beginPath();
    targetContext.arc(point.x, point.y, width / 2, 0, Math.PI * 2);
    targetContext.fill();
    targetContext.restore();
    return;
  }

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const before = points[index - 2] || previous;
    const control = previous;
    const start = midpoint(before, previous);
    const end = midpoint(previous, current);
    const width = getPointWidth(current, previous, baseWidth, stroke.mode);

    targetContext.lineWidth = width;
    targetContext.beginPath();
    targetContext.moveTo(start.x, start.y);
    targetContext.quadraticCurveTo(control.x, control.y, end.x, end.y);
    targetContext.stroke();
  }

  targetContext.restore();
}

function renderPaperBackground(targetContext, width, height, themeId) {
  const palette = getPalette(themeId || state.selectedPaletteId);
  targetContext.save();
  targetContext.fillStyle = palette.bg;
  targetContext.fillRect(0, 0, width, height);
  targetContext.fillStyle = palette.margin;
  targetContext.fillRect(70, 0, 1.2, height);
  targetContext.strokeStyle = palette.line;
  targetContext.lineWidth = 1;
  for (let lineY = 31; lineY < height; lineY += 32) {
    targetContext.beginPath();
    targetContext.moveTo(0, lineY + 0.5);
    targetContext.lineTo(width, lineY + 0.5);
    targetContext.stroke();
  }
  targetContext.restore();
}

function renderCanvas() {
  const page = getCurrentPage();
  const ratio = setCanvasTransformToCssPixels();
  const rect = DOM.board.getBoundingClientRect();
  context.clearRect(0, 0, rect.width, rect.height);
  if (!page) return;
  for (const stroke of page.strokes) {
    renderStroke(stroke, context);
  }
  if (state.activeStroke) {
    renderStroke(state.activeStroke, context);
  }
}

function queueRender() {
  if (state.renderQueued) return;
  state.renderQueued = true;
  requestAnimationFrame(() => {
    state.renderQueued = false;
    renderCanvas();
  });
}

function applyBeautifyToStroke(stroke) {
  const cloned = cloneStroke(stroke);
  if (cloned.mode !== "pen" || cloned.rawPoints.length < 2) {
    return cloned;
  }

  const rawPoints = cloned.rawPoints.map(clonePoint);
  let refinedPoints = simplifyClosePoints(rawPoints, 0.75);
  refinedPoints = smoothPoints(refinedPoints, INK_ENGINE.refineSmoothingPasses);
  refinedPoints = straightenIfAlmostLine(refinedPoints);
  refinedPoints = smoothPoints(refinedPoints, 1);

  return {
    ...cloned,
    beautified: true,
    rawPoints,
    points: refinedPoints,
  };
}

function getStrokeBounds(stroke) {
  const points = getStrokePoints(stroke);
  if (!points.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY, centerY: (minY + maxY) / 2 };
}

function normalizeCloseStrokeRows(strokes) {
  const penStrokeEntries = strokes
    .map((stroke, index) => ({ stroke, index, bounds: getStrokeBounds(stroke) }))
    .filter((entry) => entry.stroke.mode === "pen" && entry.bounds && entry.bounds.height < 90);

  if (penStrokeEntries.length < 3) return strokes;

  const rows = [];
  for (const entry of penStrokeEntries) {
    const row = rows.find((candidate) => Math.abs(candidate.centerY - entry.bounds.centerY) < 26);
    if (row) {
      row.entries.push(entry);
      row.centerY = row.entries.reduce((sum, item) => sum + item.bounds.centerY, 0) / row.entries.length;
    } else {
      rows.push({ centerY: entry.bounds.centerY, entries: [entry] });
    }
  }

  rows.sort((a, b) => a.centerY - b.centerY);
  if (rows.length < 2) return strokes;

  const gaps = rows.slice(1).map((row, index) => row.centerY - rows[index].centerY).filter((gap) => gap > 18 && gap < 80);
  if (!gaps.length) return strokes;
  const targetGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;

  const shifts = new Map();
  let expectedY = rows[0].centerY;
  rows.forEach((row, rowIndex) => {
    if (rowIndex > 0) expectedY += targetGap;
    const shift = Math.max(-INK_ENGINE.maxRowShift, Math.min(INK_ENGINE.maxRowShift, expectedY - row.centerY));
    for (const entry of row.entries) shifts.set(entry.index, shift);
  });

  return strokes.map((stroke, index) => {
    const shift = shifts.get(index) || 0;
    if (!shift || stroke.mode !== "pen") return stroke;
    const moved = cloneStroke(stroke);
    moved.points = moved.points.map((point) => ({ ...point, y: point.y + shift }));
    return moved;
  });
}

function beautifyCurrentPage() {
  const page = getCurrentPage();
  if (!page) return;
  page.strokes = normalizeCloseStrokeRows(page.strokes.map(applyBeautifyToStroke));
  page.redoStack = [];
  scheduleSave();
  renderAll();
  setStatus("Refined handwriting. Raw strokes are still saved for future AI cleanup.");
}

function redrawWithPaper(targetContext, width, height, strokes) {
  renderPaperBackground(targetContext, width, height);
  for (const stroke of strokes) {
    renderStroke(stroke, targetContext);
  }
}

function createPageExportCanvas(scale = Math.max(2, window.devicePixelRatio || 1)) {
  const page = getCurrentPage();
  if (!page) return null;
  const rect = DOM.board.getBoundingClientRect();
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = Math.max(1, Math.floor(rect.width * scale));
  exportCanvas.height = Math.max(1, Math.floor(rect.height * scale));
  const exportContext = exportCanvas.getContext("2d");
  exportContext.setTransform(scale, 0, 0, scale, 0, 0);
  renderPaperBackground(exportContext, rect.width, rect.height, page.themeId);
  for (const stroke of page.strokes) renderStroke(stroke, exportContext);
  return exportCanvas;
}

function safeFileName(text, fallback = "notebook-page") {
  return (text || fallback).replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || fallback;
}

function exportPageAsPng() {
  const page = getCurrentPage();
  const canvas = createPageExportCanvas();
  if (!page || !canvas) return;
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `${safeFileName(page.name)}.png`;
  link.click();
  state.exportMenuOpen = false;
  renderToolbarState();
  setStatus("Page saved as high-resolution PNG.");
}

function exportPageAsPdf() {
  const page = getCurrentPage();
  const project = getSelectedProject();
  const canvas = createPageExportCanvas(2);
  if (!page || !canvas) return;
  const dataUrl = canvas.toDataURL("image/png");
  const title = `${project?.name || "Notebook"} — ${page.name || "Page"}`;
  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) {
    setStatus("Allow popups, then try PDF export again.");
    return;
  }
  printWindow.document.write(`<!doctype html>
<html>
<head>
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, system-ui, -apple-system, Segoe UI, sans-serif; color: #111827; background: #f7f7f5; }
    .sheet { min-height: 100vh; padding: 18px; display: grid; gap: 14px; align-content: start; }
    .meta { display: flex; justify-content: space-between; align-items: end; gap: 18px; color: #4b5563; font-size: 12px; }
    h1 { margin: 0; color: #111827; font-size: 18px; }
    img { width: 100%; height: auto; border-radius: 18px; border: 1px solid rgba(17,24,39,.12); box-shadow: 0 14px 40px rgba(17,24,39,.10); background: #fff; }
    @media print { body { background: #fff; } .sheet { padding: 0; } img { box-shadow: none; } }
  </style>
</head>
<body>
  <main class="sheet">
    <div class="meta"><div><h1>${escapeHtml(page.name || "Notebook page")}</h1><span>${escapeHtml(project?.name || "Notebook")}</span></div><span>${new Date().toLocaleDateString()}</span></div>
    <img src="${dataUrl}" alt="${escapeHtml(title)}" />
  </main>
  <script>window.addEventListener('load', () => { setTimeout(() => window.print(), 150); });<\/script>
</body>
</html>`);
  printWindow.document.close();
  state.exportMenuOpen = false;
  renderToolbarState();
  setStatus("PDF export opened. Choose Save as PDF in the print dialog.");
}

function toggleExportMenu() {
  state.exportMenuOpen = !state.exportMenuOpen;
  renderToolbarState();
}

function startStroke(event) {
  if (event.button !== 0 && event.pointerType !== "pen") return;
  const page = getSelectedPage();
  if (!page) return;

  event.preventDefault();
  DOM.board.setPointerCapture(event.pointerId);
  const firstPoint = getPoint(event);
  state.isDrawing = true;
  state.activePointerId = event.pointerId;
  state.activeStroke = {
    mode: state.mode,
    color: state.mode === "eraser" ? "#ffffff" : state.selectedColor,
    size: state.brushSize,
    beautified: false,
    rawPoints: [firstPoint],
    points: [firstPoint],
  };
  queueRender();
}

function getPoint(event) {
  const rect = DOM.board.getBoundingClientRect();
  const pressure = event.pressure && event.pressure > 0 ? event.pressure : event.pointerType === "pen" ? 0.65 : 0.5;
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    pressure,
    time: performance.now(),
  };
}

function getEventPoints(event) {
  const sourceEvents = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [event];
  return sourceEvents.map(getPoint);
}

function updateLiveStrokePoints() {
  if (!state.activeStroke) return;
  const rawPoints = state.activeStroke.rawPoints || state.activeStroke.points || [];
  const now = performance.now();
  let delayedPoints = rawPoints.filter((point) => now - point.time >= INK_ENGINE.liveDelayMs);
  if (delayedPoints.length < 2) delayedPoints = rawPoints.slice(0, Math.min(rawPoints.length, 2));
  state.activeStroke.points = smoothPoints(simplifyClosePoints(delayedPoints, 0.55), INK_ENGINE.liveSmoothingPasses);
}

function extendStroke(event) {
  if (!state.isDrawing || state.activePointerId !== event.pointerId || !state.activeStroke) return;
  event.preventDefault();
  const rawPoints = state.activeStroke.rawPoints || state.activeStroke.points;
  for (const nextPoint of getEventPoints(event)) {
    const lastPoint = rawPoints[rawPoints.length - 1];
    if (shouldStorePoint(lastPoint, nextPoint)) {
      rawPoints.push(nextPoint);
    } else if (rawPoints.length) {
      rawPoints[rawPoints.length - 1] = nextPoint;
    }
  }
  state.activeStroke.rawPoints = rawPoints;
  updateLiveStrokePoints();
  queueRender();
}

function finishStroke(event) {
  if (!state.isDrawing || state.activePointerId !== event.pointerId) return;
  const page = getSelectedPage();
  if (page && state.activeStroke && (state.activeStroke.rawPoints?.length || state.activeStroke.points?.length)) {
    const rawPoints = (state.activeStroke.rawPoints || state.activeStroke.points).map(clonePoint);
    const finalStroke = cloneStroke({
      ...state.activeStroke,
      rawPoints,
      points: smoothPoints(simplifyClosePoints(rawPoints, 0.55), 1),
    });
    page.strokes.push(finalStroke);
    page.redoStack = [];
  }
  state.isDrawing = false;
  state.activePointerId = null;
  state.activeStroke = null;
  saveNow();
  renderCanvas();
  setStatus("Stroke saved as raw points + smooth ink.");
}

function undoStroke() {
  const page = getCurrentPage();
  if (!page || !page.strokes.length) return;
  const stroke = page.strokes.pop();
  page.redoStack.push(stroke);
  scheduleSave();
  renderAll();
  setStatus("Stroke undone.");
}

function redoStroke() {
  const page = getCurrentPage();
  if (!page || !page.redoStack.length) return;
  const stroke = page.redoStack.pop();
  page.strokes.push(stroke);
  scheduleSave();
  renderAll();
  setStatus("Stroke restored.");
}

function clearCurrentPage() {
  const page = getCurrentPage();
  if (!page) return;
  const shouldClear = window.confirm(`Clear page \"${page.name}\"? This removes all drawings on the current page.`);
  if (!shouldClear) return;
  page.strokes = [];
  page.redoStack = [];
  state.activeStroke = null;
  scheduleSave();
  renderAll();
  setStatus("Page cleared.");
}

function renderProjectList() {
  DOM.projectList.innerHTML = state.projects
    .map((project) => {
      const active = project.id === state.selectedProjectId;
      const menuOpen = state.menu?.type === "project" && state.menu?.id === project.id;
      const pageList = project.expanded
        ? `<div class="page-list">${project.pages
            .map((page) => {
              const selected = active && page.id === state.selectedPageId;
              const pageMenuOpen = state.menu?.type === "page" && state.menu?.id === page.id;
              return `
                <div class="page-row">
                  <button class="page-item ${selected ? "is-active" : ""}" data-action="select-page" data-project-id="${project.id}" data-page-id="${page.id}">
                    <span class="emoji-avatar" aria-hidden="true">${getEmojiForId(page.id, "📄")}</span>
                    <span class="page-name">${escapeHtml(page.name)}</span>
                  </button>
                  <button class="menu-button" data-action="toggle-page-menu" data-project-id="${project.id}" data-page-id="${page.id}" aria-label="Page menu">⋯</button>
                  ${pageMenuOpen ? pageMenuHtml(project.id, page.id, "page") : ""}
                </div>`;
            })
            .join("")}</div>`
        : "";

      return `
        <div class="project-card ${active ? "is-active" : ""} ${project.expanded ? "is-open" : ""}">
          <div class="project-row">
            <button class="project-main" data-action="select-project" data-project-id="${project.id}">
              <span class="chevron">${project.expanded ? "▾" : "▸"}</span>
              <span class="emoji-avatar project-emoji" aria-hidden="true">${getEmojiForId(project.id, "📚")}</span>
              <span class="project-name">${escapeHtml(project.name)}</span>
              <span class="count">${project.pages.length}</span>
            </button>
            <button class="menu-button" data-action="toggle-project-menu" data-project-id="${project.id}" aria-label="Project menu">⋯</button>
          </div>
          ${menuOpen ? pageMenuHtml(project.id, null, "project") : ""}
          ${pageList}
        </div>`;
    })
    .join("");
}

function pageMenuHtml(projectId, pageId, type) {
  const renameAction = type === "project" ? `rename-project` : `rename-page`;
  const deleteAction = type === "project" ? `delete-project` : `delete-page`;
  return `
    <div class="menu-popover">
      <button data-action="${renameAction}" data-project-id="${projectId}" ${pageId ? `data-page-id="${pageId}"` : ""}>Rename</button>
      <button data-action="${deleteAction}" data-project-id="${projectId}" ${pageId ? `data-page-id="${pageId}"` : ""}>Delete</button>
    </div>`;
}

function renderPalettePicker() {
  DOM.paletteList.innerHTML = PALETTES.map((palette) => {
    const active = palette.id === state.selectedPaletteId;
    return `
      <button class="palette-card ${active ? "is-active" : ""}" data-action="select-palette" data-palette-id="${palette.id}">
        <span class="palette-meta"><span class="palette-title">${escapeHtml(palette.name)}</span><span class="palette-dot">✨</span></span>
        <span class="palette-samples">
          <span class="sample" style="background:${palette.bg}"></span>
          <span class="sample" style="background:${palette.line}"></span>
          <span class="sample" style="background:${palette.margin}"></span>
          <span class="sample" style="background:${palette.border}"></span>
        </span>
      </button>`;
  }).join("");
}

function renderColorSwatches() {
  DOM.colorSwatches.innerHTML = INK_COLORS
    .map(
      (color) => `
        <button class="color-swatch ${state.selectedColor === color ? "is-active" : ""}" data-action="select-color" data-color="${color}" title="${color}" style="--swatch:${color}"></button>`,
    )
    .join("");
}

function renderToolbarState() {
  const project = getSelectedProject();
  const page = getSelectedPage();
  DOM.projectTitle.textContent = project ? project.name : "No project";
  DOM.pageTitle.textContent = page ? page.name : "No page";
  DOM.brushSize.value = String(state.brushSize);
  DOM.penBtn.classList.toggle("is-active", state.mode === "pen");
  DOM.eraserBtn.classList.toggle("is-active", state.mode === "eraser");
  DOM.appShell.classList.toggle("sidebar-open", state.sidebarOpen);
  DOM.appShell.classList.toggle("sidebar-collapsed", !state.sidebarOpen);
  DOM.appShell.classList.toggle("export-open", state.exportMenuOpen);
  if (DOM.exportMenu) DOM.exportMenu.hidden = !state.exportMenuOpen;
  applyTheme();
}

function renderAllSidebar() {
  renderProjectList();
  renderPalettePicker();
  renderToolbarState();
}

function renderAll() {
  ensureWorkspace();

  const page = getSelectedPage();
  const themeId = page?.themeId || state.selectedPaletteId;
  state.selectedPaletteId = themeId;
  applyPaperTheme(themeId);

  renderAllSidebar();
  renderColorSwatches();
  renderCanvas();
}

function handleSidebarClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  const projectId = button.dataset.projectId;
  const pageId = button.dataset.pageId;

  if (action === "select-project") {
    if (event.target.closest(".menu-button")) return;
    selectProject(projectId);
    return;
  }

  if (action === "toggle-project-menu") {
    state.menu = state.menu?.type === "project" && state.menu?.id === projectId ? null : { type: "project", id: projectId };
    renderAllSidebar();
    return;
  }

  if (action === "toggle-page-menu") {
    state.menu = state.menu?.type === "page" && state.menu?.id === pageId ? null : { type: "page", id: pageId };
    renderAllSidebar();
    return;
  }

  if (action === "select-page") {
    selectPage(projectId, pageId);
    return;
  }

  if (action === "rename-project") {
    renameProject(projectId);
    return;
  }

  if (action === "delete-project") {
    deleteProject(projectId);
    return;
  }

  if (action === "rename-page") {
    renamePage(projectId, pageId);
    return;
  }

  if (action === "delete-page") {
    deletePage(projectId, pageId);
    return;
  }

  if (action === "select-palette") {
    setActivePalette(button.dataset.paletteId);
    return;
  }

  if (action === "select-color") {
    setSelectedColor(button.dataset.color);
  }
}

function handleToolbarClick(event) {
  const button = event.target.closest("button[data-toolbar-action]");
  if (!button) return;
  const action = button.dataset.toolbarAction;
  if (action === "sidebar-toggle") toggleSidebar();
  if (action === "new-project") createProject();
  if (action === "new-page") createPage();
  if (action === "pen") setMode("pen");
  if (action === "eraser") setMode("eraser");
  if (action === "undo") undoStroke();
  if (action === "redo") redoStroke();
  if (action === "beautify") beautifyCurrentPage();
  if (action === "save") {
    saveNow();
    setStatus("Saved locally.");
  }
  if (action === "theme-toggle") toggleTheme();
  if (action === "export") toggleExportMenu();
  if (action === "export-png") exportPageAsPng();
  if (action === "export-pdf") exportPageAsPdf();
  if (action === "clear") clearCurrentPage();
}

function initEvents() {
  DOM.sidebar.addEventListener("click", handleSidebarClick);
  DOM.appShell.addEventListener("click", handleToolbarClick);
  DOM.scrim.addEventListener("click", () => toggleSidebar(false));
  DOM.colorSwatches.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action='select-color']");
    if (!button) return;
    setSelectedColor(button.dataset.color);
  });

  DOM.brushSize.addEventListener("input", (event) => {
    state.brushSize = Number(event.target.value);
    scheduleSave();
  });

  DOM.board.addEventListener("pointerdown", startStroke);
  DOM.board.addEventListener("pointermove", extendStroke);
  DOM.board.addEventListener("pointerup", finishStroke);
  DOM.board.addEventListener("pointercancel", finishStroke);
  DOM.board.addEventListener("lostpointercapture", finishStroke);
  DOM.board.addEventListener("contextmenu", (event) => event.preventDefault());

  document.addEventListener("click", (event) => {
    if (event.target.closest(".menu-button") || event.target.closest(".menu-popover") || event.target.closest(".export-group")) return;
    let changed = false;
    if (state.menu) {
      state.menu = null;
      changed = true;
    }
    if (state.exportMenuOpen) {
      state.exportMenuOpen = false;
      changed = true;
    }
    if (changed) renderAllSidebar();
  });

  window.addEventListener("resize", () => {
    resizeCanvas();
    if (window.innerWidth > 980 && state.sidebarOpen === false) {
      // Keep user choice on mobile, but don't force the sidebar closed on desktop.
    }
  });

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(DOM.board.parentElement);
  }
}

function boot() {
  loadWorkspace();
  initEvents();
  ensureWorkspace();
  if (window.innerWidth <= 980 && !localStorage.getItem(STORAGE_KEY)) {
    state.sidebarOpen = false;
  }
  applyTheme();
  renderAll();
  resizeCanvas();
  setStatus(state.projects.length ? "Workspace loaded." : "Autosaves locally in this browser.");
  setMode(state.mode);
}

// Future AI hooks:
// - beautifyCurrentPage() is now the local refinement stage; replace it later with a real ML handwriting model.
// - Add handwriting recognition for searchable notes.
// - Learn the user's personal writing style and recreate it cleanly.
// - Transform rough stroke input into personalized clean handwriting.

boot();



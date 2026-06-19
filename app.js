import { playClick, playSelect, playStrokeStart, isMuted, toggleMuted } from "./sound.js";

const STORAGE_KEY = "simple-notebook-workspace-v1";
const THEME_KEY = "simple-notebook-theme-v1";
 
 
const INK_COLORS = ["#1d4ed8", "#ec4899", "#38bdf8", "#f97316", "#111827"];
 
const TOOL_PRESETS = {
  pen: { label: "Pen", widthMultiplier: 1, opacity: 1, composite: "source-over", smoothingPasses: 1 },
  brush: { label: "Brush", widthMultiplier: 1.55, opacity: 0.9, composite: "source-over", smoothingPasses: 2 },
  oilPastel: { label: "Oil Pastel", widthMultiplier: 1.85, opacity: 0.72, composite: "source-over", smoothingPasses: 1, textured: true },
  marker: { label: "Marker", widthMultiplier: 1.35, opacity: 0.78, composite: "source-over", smoothingPasses: 1 },
  pencil: { label: "Pencil", widthMultiplier: 0.78, opacity: 0.82, composite: "source-over", smoothingPasses: 1, textured: true },
  highlighter: { label: "Highlighter", widthMultiplier: 3.2, opacity: 0.28, composite: "multiply", smoothingPasses: 1 },
};
 
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
  drawerPanel: document.getElementById("drawerPanel"),
  drawerTitle: document.getElementById("drawerTitle"),
  newProjectBtn: document.getElementById("newProjectBtn"),
  newPageBtn: document.getElementById("newPageBtn"),
  projectList: document.getElementById("projectList"),
  paletteToggleBtn: document.getElementById("paletteToggleBtn"),
  paletteMenu: document.getElementById("paletteMenu"),
  paletteActiveName: document.getElementById("paletteActiveName"),
  projectTitle: document.getElementById("projectTitle"),
  pageTitle: document.getElementById("pageTitle"),
  colorSwatches: document.getElementById("colorSwatches"),
  toolSelect: document.getElementById("toolSelect"),
  brushSize: document.getElementById("brushSize"),
  zoomSlider: document.getElementById("zoomSlider"),
  zoomValue: document.getElementById("zoomValue"),
  paperFrame: document.querySelector(".paper-frame"),
  penBtn: document.getElementById("penBtn"),
  eraserBtn: document.getElementById("eraserBtn"),
  undoBtn: document.getElementById("undoBtn"),
  redoBtn: document.getElementById("redoBtn"),
  saveBtn: document.getElementById("saveBtn"),
  uploadImageBtn: document.getElementById("uploadImageBtn"),
  removeImageBtn: document.getElementById("removeImageBtn"),
  pictureInput: document.getElementById("pictureInput"),
  imageLayer: document.getElementById("imageLayer"),
  themeToggle: document.getElementById("themeToggle"),
  soundToggle: document.getElementById("soundToggle"),
  exportMenu: document.getElementById("exportMenu"),
  exportBtn: document.getElementById("exportBtn"),
  clearBtn: document.getElementById("clearBtn"),
  board: document.getElementById("board"),
  status: document.getElementById("status"),
  pdfChoiceModal: document.getElementById("pdfChoiceModal"),
  pdfThisPageBtn: document.getElementById("pdfThisPageBtn"),
  pdfWholeProjectBtn: document.getElementById("pdfWholeProjectBtn"),
  pdfCancelBtn: document.getElementById("pdfCancelBtn"),
};
 
const context = DOM.board.getContext("2d");
 
const state = {
  projects: [],
  selectedProjectId: null,
  selectedPageId: null,
  selectedPaletteId: "soft-pastel",
  selectedColor: INK_COLORS[0],
  brushSize: 4,
  zoomPercent: 100,
  mode: "pen",
  sidebarOpen: true,
  theme: "light",
  exportMenuOpen: false,
  paletteMenuOpen: false,
  menu: null,
  isDrawing: false,
  activePointerId: null,
  activeStroke: null,
  saveTimer: null,
  statusTimer: null,
  renderQueued: false,
};

function getZoomFactor() {
  return Math.min(1.5, Math.max(0.75, Number(state.zoomPercent) / 100 || 1));
}

function getUnzoomedPointer(event, element) {
  const rect = element.getBoundingClientRect();
  const zoom = getZoomFactor();
  return {
    x: (event.clientX - rect.left) / zoom,
    y: (event.clientY - rect.top) / zoom,
    rect,
    zoom,
  };
}

function getUnzoomedPageSize() {
  const rect = DOM.board.getBoundingClientRect();
  const zoom = getZoomFactor();
  return {
    width: Math.max(1, rect.width / zoom),
    height: Math.max(1, rect.height / zoom),
    zoom,
  };
}
 
// ─── Image interaction state ──────────────────────────────────────────────────
const HANDLE_HIT = 12; // px hit radius for corner handles
const HANDLE_SIZE = 8; // visual half-size

let imageInteraction = {
  active: false,
  mode: null,   // "drag" | "resize"
  handle: null, // "nw" | "ne" | "sw" | "se"
  startX: 0,
  startY: 0,
  origX: 0,
  origY: 0,
  origWidth: 0,
  origHeight: 0,
  origAspect: 1,
};

// state.mode === "move" → interact with image; any other mode → draw.

function getImageHandles(img) {
  return [
    { name: "nw", x: img.x,             y: img.y },
    { name: "ne", x: img.x + img.width, y: img.y },
    { name: "sw", x: img.x,             y: img.y + img.height },
    { name: "se", x: img.x + img.width, y: img.y + img.height },
  ];
}

function getHitHandle(img, x, y, hitRadius = HANDLE_HIT) {
  return getImageHandles(img).find(
    (h) => Math.abs(h.x - x) <= hitRadius && Math.abs(h.y - y) <= hitRadius
  ) || null;
}

function isInsideImage(img, x, y) {
  return x >= img.x && x <= img.x + img.width && y >= img.y && y <= img.y + img.height;
}

function updateImageCursor(x, y) {
  const page = getCurrentPage();
  const img = page?.backgroundImage;
  if (!img || state.mode !== "move") { DOM.imageLayer.style.cursor = ""; return; }
  const handle = getHitHandle(img, x, y, HANDLE_HIT / getZoomFactor());
  if (handle) {
    const cursors = { nw: "nw-resize", ne: "ne-resize", sw: "sw-resize", se: "se-resize" };
    DOM.imageLayer.style.cursor = cursors[handle.name];
  } else if (isInsideImage(img, x, y)) {
    DOM.imageLayer.style.cursor = "grab";
  } else {
    DOM.imageLayer.style.cursor = "default";
  }
}

DOM.imageLayer.addEventListener("pointermove", (event) => {
  const { x, y } = getUnzoomedPointer(event, DOM.imageLayer);

  if (!imageInteraction.active) {
    updateImageCursor(x, y);
    return;
  }

  const page = getCurrentPage();
  if (!page?.backgroundImage) return;
  const img = page.backgroundImage;
  const { origX, origY, origWidth, origHeight, origAspect } = imageInteraction;

  if (imageInteraction.mode === "drag") {
    img.x = origX + (x - imageInteraction.startX);
    img.y = origY + (y - imageInteraction.startY);
  } else if (imageInteraction.mode === "resize") {
    const dx = x - imageInteraction.startX;
    switch (imageInteraction.handle) {
      case "se": {
        const w = Math.max(40, origWidth + dx);
        img.width = w; img.height = w / origAspect;
        break;
      }
      case "sw": {
        const w = Math.max(40, origWidth - dx);
        img.x = origX + (origWidth - w);
        img.width = w; img.height = w / origAspect;
        break;
      }
      case "ne": {
        const w = Math.max(40, origWidth + dx);
        const h = w / origAspect;
        img.y = origY + (origHeight - h);
        img.width = w; img.height = h;
        break;
      }
      case "nw": {
        const w = Math.max(40, origWidth - dx);
        const h = w / origAspect;
        img.x = origX + (origWidth - w);
        img.y = origY + (origHeight - h);
        img.width = w; img.height = h;
        break;
      }
    }
  }
  renderImageLayer();
});

DOM.imageLayer.addEventListener("pointerdown", (event) => {
  const page = getCurrentPage();
  if (!page?.backgroundImage) return;
  if (state.mode !== "move") return;
  event.preventDefault();
  event.stopPropagation();
  DOM.imageLayer.setPointerCapture(event.pointerId);

  const { x, y } = getUnzoomedPointer(event, DOM.imageLayer);
  const img = page.backgroundImage;
  const handle = getHitHandle(img, x, y, HANDLE_HIT / getZoomFactor());

  imageInteraction = {
    active: true,
    mode: handle ? "resize" : "drag",
    handle: handle?.name || null,
    startX: x,
    startY: y,
    origX: img.x,
    origY: img.y,
    origWidth: img.width,
    origHeight: img.height,
    origAspect: img.width / img.height,
  };
  if (!handle) DOM.imageLayer.style.cursor = "grabbing";
});

DOM.imageLayer.addEventListener("pointerup", (event) => {
  if (!imageInteraction.active) return;
  imageInteraction.active = false;
  imageInteraction.mode = null;
  saveNow();
  renderImageLayer();
  const { x, y } = getUnzoomedPointer(event, DOM.imageLayer);
  updateImageCursor(x, y);
});

DOM.imageLayer.addEventListener("pointercancel", () => {
  imageInteraction.active = false;
  imageInteraction.mode = null;
});
// ─────────────────────────────────────────────────────────────────────────────

// ─── Image alignment helpers ──────────────────────────────────────────────────
function alignImage(alignment) {
  const page = getCurrentPage();
  const img = page?.backgroundImage;
  if (!img) { setStatus("No picture on this page."); return; }
  const { width: pageWidth } = getUnzoomedPageSize();
  if (alignment === "left")   img.x = 0;
  if (alignment === "center") img.x = (pageWidth - img.width) / 2;
  if (alignment === "right")  img.x = pageWidth - img.width;
  saveNow();
  renderImageLayer();
  setStatus("Image aligned " + alignment + ".");
}
// ─────────────────────────────────────────────────────────────────────────────
 
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
    mode: stroke.mode === "eraser" ? "eraser" : (TOOL_PRESETS[stroke.mode] ? stroke.mode : "pen"),
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
    backgroundImage: null,
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
      page.backgroundImage = page.backgroundImage && page.backgroundImage.dataUrl ? page.backgroundImage : null;
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
  state.zoomPercent = Math.min(150, Math.max(75, Number(state.zoomPercent) || 100));
  state.mode = (state.mode === "eraser" || state.mode === "move") ? state.mode : (TOOL_PRESETS[state.mode] ? state.mode : "pen");
}

function applyZoom() {
  const percent = Math.min(150, Math.max(75, Number(state.zoomPercent) || 100));
  state.zoomPercent = percent;
  if (DOM.paperFrame) {
    DOM.paperFrame.style.setProperty("--page-zoom", String(percent / 100));
  }
  if (DOM.zoomSlider) DOM.zoomSlider.value = String(percent);
  if (DOM.zoomValue) DOM.zoomValue.textContent = `${percent}%`;
  resizeCanvas();
  renderImageLayer();
}

function setZoomPercent(percent) {
  state.zoomPercent = Math.min(150, Math.max(75, Math.round(percent / 5) * 5));
  applyZoom();
  scheduleSave();
}
 
function serializeWorkspace() {
  return {
    projects: state.projects,
    selectedProjectId: state.selectedProjectId,
    selectedPageId: state.selectedPageId,
    selectedPaletteId: state.selectedPaletteId,
    selectedColor: state.selectedColor,
    brushSize: state.brushSize,
    zoomPercent: state.zoomPercent,
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

function renderSoundToggleState() {
  if (!DOM.soundToggle) return;
  const muted = isMuted();
  const glyph = DOM.soundToggle.querySelector(".icon-glyph");
  if (glyph) glyph.textContent = muted ? "🔇" : "🔊";
  DOM.soundToggle.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
  DOM.soundToggle.dataset.tooltip = muted ? "Unmute Sound" : "Mute Sound";
}
 
function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  applyTheme();
  scheduleSave();
  setStatus(`${state.theme === "dark" ? "Dark" : "Light"} mode enabled.`);
}
 
function getEmojiForId(id, fallback = "✨") {
  const emojis = ["😊", "🎨", "📚", "🚀", "💡", "✨", "🌙", "📝", "🌿", "⭐"];
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
    state.zoomPercent = Number(parsed.zoomPercent) || state.zoomPercent;
    state.mode = (parsed.mode === "eraser" || parsed.mode === "move") ? parsed.mode : (TOOL_PRESETS[parsed.mode] ? parsed.mode : "pen");
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
  state.paletteMenuOpen = false;
  renderPalettePicker();
  setStatus("Notebook theme changed.");
}
 
function setSelectedColor(color) {
  state.selectedColor = color;
  scheduleSave();
  renderAll();
}
 
function setMode(mode) {
  if (mode === "move") {
    state.mode = "move";
  } else if (mode === "eraser") {
    state.mode = "eraser";
  } else {
    state.mode = TOOL_PRESETS[mode] ? mode : "pen";
  }
  if (DOM.imageLayer) {
    DOM.imageLayer.style.pointerEvents = state.mode === "move" ? "auto" : "none";
    DOM.imageLayer.style.zIndex = state.mode === "move" ? "3" : "0";
  }
  if (DOM.board) {
    DOM.board.style.pointerEvents = state.mode === "move" ? "none" : "auto";
  }
  scheduleSave();
  renderAll();
  if (state.mode === "move") {
    setStatus("Move mode — drag image, drag corners to resize.");
  } else if (state.mode === "eraser") {
    setStatus("Eraser selected.");
  } else {
    setStatus(`${TOOL_PRESETS[state.mode].label} selected.`);
  }
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
  toggleSidebar(true);
  if (DOM.drawerTitle) DOM.drawerTitle.textContent = "Projects";
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
  toggleSidebar(true);
  if (DOM.drawerTitle) DOM.drawerTitle.textContent = "Pages";
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
  const zoom = getZoomFactor();
  context.setTransform(ratio * zoom, 0, 0, ratio * zoom, 0, 0);
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
 
function drawCurvePass(points, stroke, targetContext, baseWidth, jitter = 0) {
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const before = points[index - 2] || previous;
    const control = previous;
    const start = midpoint(before, previous);
    const end = midpoint(previous, current);
    const offsetX = jitter ? Math.sin(index * 12.9898 + stroke.size) * jitter : 0;
    const offsetY = jitter ? Math.cos(index * 78.233 + stroke.size) * jitter : 0;
    const width = getPointWidth(current, previous, baseWidth, stroke.mode);
 
    targetContext.lineWidth = width;
    targetContext.beginPath();
    targetContext.moveTo(start.x + offsetX, start.y + offsetY);
    targetContext.quadraticCurveTo(control.x + offsetX, control.y + offsetY, end.x + offsetX, end.y + offsetY);
    targetContext.stroke();
  }
}
 
function renderStroke(stroke, targetContext = context) {
  const sourcePoints = getStrokePoints(stroke);
  const preset = TOOL_PRESETS[stroke.mode] || TOOL_PRESETS.pen;
  const passes = stroke.beautified ? 2 : (preset.smoothingPasses || INK_ENGINE.liveSmoothingPasses);
  const points = simplifyClosePoints(smoothPoints(sourcePoints, passes), 0.55);
  if (!points.length) return;
 
  targetContext.save();
  targetContext.globalCompositeOperation = stroke.mode === "eraser" ? "destination-out" : (preset.composite || "source-over");
  targetContext.globalAlpha = stroke.mode === "eraser" ? 1 : (preset.opacity ?? 1);
  targetContext.lineCap = "round";
  targetContext.lineJoin = "round";
  targetContext.strokeStyle = stroke.color;
  targetContext.fillStyle = stroke.color;
 
  const baseWidth = stroke.mode === "eraser" ? stroke.size * 2.4 : stroke.size * (preset.widthMultiplier || 1);
 
  if (points.length === 1) {
    const point = points[0];
    const width = getPointWidth(point, null, baseWidth, stroke.mode);
    targetContext.beginPath();
    targetContext.arc(point.x, point.y, width / 2, 0, Math.PI * 2);
    targetContext.fill();
    targetContext.restore();
    return;
  }
 
  drawCurvePass(points, stroke, targetContext, baseWidth, 0);
 
  if (preset.textured) {
    targetContext.globalAlpha = Math.max(0.16, (preset.opacity ?? 1) * 0.42);
    targetContext.lineWidth = Math.max(0.7, baseWidth * 0.36);
    drawCurvePass(points, stroke, targetContext, Math.max(0.7, baseWidth * 0.42), 0.9);
    drawCurvePass(points, stroke, targetContext, Math.max(0.7, baseWidth * 0.28), -0.7);
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
 
function renderImageLayer() {
  const page = getCurrentPage();
  const image = page?.backgroundImage;
  if (!DOM.imageLayer) return;

  if (!image?.dataUrl) {
    DOM.imageLayer.style.backgroundImage = "";
    DOM.imageLayer.hidden = true;
    const old = DOM.imageLayer.querySelector("canvas.img-handles");
    if (old) old.remove();
    return;
  }

  const zoom = getZoomFactor();
  DOM.imageLayer.hidden = false;
  DOM.imageLayer.style.backgroundImage = `url("${image.dataUrl}")`;
  DOM.imageLayer.style.backgroundSize = `${image.width * zoom}px ${image.height * zoom}px`;
  DOM.imageLayer.style.backgroundPosition = `${(image.x || 0) * zoom}px ${(image.y || 0) * zoom}px`;
  DOM.imageLayer.style.backgroundRepeat = "no-repeat";
  DOM.imageLayer.style.zIndex = state.mode === "move" ? "3" : "0";
  DOM.board.style.pointerEvents = state.mode === "move" ? "none" : "auto";

  let handleCanvas = DOM.imageLayer.querySelector("canvas.img-handles");
  if (!handleCanvas) {
    handleCanvas = document.createElement("canvas");
    handleCanvas.className = "img-handles";
    handleCanvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;";
    DOM.imageLayer.appendChild(handleCanvas);
  }

  const rect = DOM.imageLayer.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  handleCanvas.width = Math.max(1, Math.floor(rect.width * ratio));
  handleCanvas.height = Math.max(1, Math.floor(rect.height * ratio));
  const hctx = handleCanvas.getContext("2d");
  hctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  hctx.clearRect(0, 0, rect.width, rect.height);

  if (state.mode === "move") {
    const ix = (image.x || 0) * zoom;
    const iy = (image.y || 0) * zoom;
    const iw = image.width * zoom;
    const ih = image.height * zoom;

    hctx.strokeStyle = "rgba(99,102,241,0.85)";
    hctx.lineWidth = 1.5;
    hctx.setLineDash([5, 4]);
    hctx.strokeRect(ix + 0.75, iy + 0.75, iw - 1.5, ih - 1.5);
    hctx.setLineDash([]);

    for (const h of getImageHandles(image)) {
      const s = HANDLE_SIZE;
      const hx = h.x * zoom;
      const hy = h.y * zoom;
      hctx.shadowColor = "rgba(0,0,0,0.22)";
      hctx.shadowBlur = 5;
      hctx.fillStyle = "#ffffff";
      hctx.strokeStyle = "rgba(99,102,241,0.95)";
      hctx.lineWidth = 1.8;
      hctx.beginPath();
      if (hctx.roundRect) {
        hctx.roundRect(hx - s, hy - s, s * 2, s * 2, 3);
      } else {
        hctx.rect(hx - s, hy - s, s * 2, s * 2);
      }
      hctx.fill();
      hctx.stroke();
      hctx.shadowBlur = 0;
    }
  }
}

 
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}
 
// ─── FIX: drawPageImage now honours the manual x/y/width/height ──────────────
async function drawPageImage(targetContext, page, width, height) {
  const imageData = page?.backgroundImage;
  if (!imageData?.dataUrl) return;
  try {
    const image = await loadImage(imageData.dataUrl);
 
    // Honour the manual position & size set by the user (drag / corner resize)
    if (imageData.fit === "manual" && imageData.width && imageData.height) {
      targetContext.save();
      targetContext.drawImage(
        image,
        imageData.x ?? 0,
        imageData.y ?? 0,
        imageData.width,
        imageData.height
      );
      targetContext.restore();
      return;
    }
 
    // Legacy fallback: centre-fit contain / cover
    const imageRatio = image.naturalWidth / image.naturalHeight;
    const frameRatio = width / height;
    let drawWidth = width;
    let drawHeight = height;
    if ((imageData.fit || "contain") === "contain") {
      if (imageRatio > frameRatio) {
        drawHeight = width / imageRatio;
      } else {
        drawWidth = height * imageRatio;
      }
    } else if (imageData.fit === "cover") {
      if (imageRatio > frameRatio) {
        drawWidth = height * imageRatio;
      } else {
        drawHeight = width / imageRatio;
      }
    }
    const drawX = (width - drawWidth) / 2;
    const drawY = (height - drawHeight) / 2;
    targetContext.save();
    targetContext.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    targetContext.restore();
  } catch {
    setStatus("Could not include the uploaded picture in export.");
  }
}
// ─────────────────────────────────────────────────────────────────────────────
 
function renderCanvas() {
  const page = getCurrentPage();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, DOM.board.width, DOM.board.height);
  setCanvasTransformToCssPixels();
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
  if (cloned.mode === "eraser" || cloned.rawPoints.length < 2) {
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
    .filter((entry) => entry.stroke.mode !== "eraser" && entry.bounds && entry.bounds.height < 90);
 
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
    if (!shift || stroke.mode === "eraser") return stroke;
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
 
async function redrawWithPaper(targetContext, width, height, page) {
  renderPaperBackground(targetContext, width, height, page?.themeId);
  await drawPageImage(targetContext, page, width, height);
  const strokeLayer = document.createElement("canvas");
  const scale = targetContext.getTransform().a || 1;
  strokeLayer.width = Math.max(1, Math.floor(width * scale));
  strokeLayer.height = Math.max(1, Math.floor(height * scale));
  const strokeContext = strokeLayer.getContext("2d");
  strokeContext.setTransform(scale, 0, 0, scale, 0, 0);
  for (const stroke of page?.strokes || []) {
    renderStroke(stroke, strokeContext);
  }
  targetContext.save();
  targetContext.setTransform(1, 0, 0, 1, 0, 0);
  targetContext.drawImage(strokeLayer, 0, 0);
  targetContext.restore();
}
 
async function createPageExportCanvas(scale = Math.max(2, window.devicePixelRatio || 1), page = getCurrentPage()) {
  if (!page) return null;
  const { width: pageWidth, height: pageHeight } = getUnzoomedPageSize();
  const exportWidth = Math.floor(2100 * scale / 2);
  const exportHeight = Math.round(exportWidth * 297 / 210);
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = Math.max(1, exportWidth);
  exportCanvas.height = Math.max(1, exportHeight);
  const exportContext = exportCanvas.getContext("2d");
  const targetScale = exportCanvas.width / pageWidth;
  exportContext.setTransform(targetScale, 0, 0, targetScale, 0, 0);
  await redrawWithPaper(exportContext, pageWidth, pageHeight, page);
  return exportCanvas;
}
 
function safeFileName(text, fallback = "notebook-page") {
  return (text || fallback).replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || fallback;
}
 
async function exportPageAsPng() {
  const page = getCurrentPage();
  const canvas = await createPageExportCanvas();
  if (!page || !canvas) return;
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `${safeFileName(page.name)}.png`;
  link.click();
  state.exportMenuOpen = false;
  renderToolbarState();
  setStatus("Current page saved as high-resolution PNG.");
}
 
// ─── FIX: writePdfDocument — professional A4 layout ──────────────────────────
function writePdfDocument(printWindow, title, pages) {
  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const pageMarkup = pages.map((item, i) => `
    <section class="sheet">
      <header class="sheet-header">
        <div class="sheet-title-block">
          <span class="project-label">${escapeHtml(item.projectName)}</span>
          <h1 class="page-name">${escapeHtml(item.pageName)}</h1>
        </div>
        <div class="sheet-meta">
          <span class="page-num">Page ${i + 1} of ${pages.length}</span>
          <span class="date-stamp">${date}</span>
        </div>
      </header>
      <div class="canvas-wrap">
        <img src="${item.dataUrl}" alt="${escapeHtml(item.pageName)}" />
      </div>
    </section>`).join("");
 
  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 210mm;
      height: 297mm;
    }
    body {
      font-family: Inter, "Segoe UI", system-ui, -apple-system, sans-serif;
      background: #f0ede8;
      color: #111827;
    }
    @media print {
      body { background: #fff; }
      .sheet { box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; }
    }
    @media screen {
      body { padding: 24px; }
      .sheet {
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(17,24,39,.14);
        margin: 0 auto 28px;
        max-width: 800px;
      }
    }
    .sheet {
      display: flex;
      flex-direction: column;
      width: 210mm;
      height: 297mm;
      padding: 18mm 16mm 14mm;
      break-after: page;
      page-break-after: always;
      overflow: hidden;
    }
    .sheet:last-child { break-after: auto; page-break-after: auto; }
    .sheet-header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 6mm;
      border-bottom: 1.5px solid #e5e7eb;
      margin-bottom: 6mm;
      flex-shrink: 0;
    }
    .project-label {
      display: block;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: #6b7280;
      margin-bottom: 3px;
    }
    .page-name { font-size: 18px; font-weight: 700; color: #111827; line-height: 1.1; }
    .sheet-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
    .page-num { font-size: 10px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.1em; }
    .date-stamp { font-size: 11px; color: #6b7280; font-weight: 500; }
    .canvas-wrap { flex: 1 1 auto; min-height: 0; display: flex; align-items: stretch; }
    .canvas-wrap img {
      width: 100%;
      height: 100%;
      display: block;
      border-radius: 10px;
      border: 1px solid rgba(17,24,39,.09);
      object-fit: contain;
      object-position: top center;
    }
  </style>
</head>
<body>
  ${pageMarkup}
  <script>window.addEventListener('load', () => { setTimeout(() => { window.focus(); window.print(); }, 400); });<\/script>
</body>
</html>`);
  printWindow.document.close();
}
// ─────────────────────────────────────────────────────────────────────────────
 
async function exportPageAsPdf(exportType = "page") {
  const page = getCurrentPage();
  const project = getSelectedProject();
  if (!page || !project) return;
 
  const currentPageOnly = exportType === "page";
 
  const pagesToExport = currentPageOnly ? [page] : project.pages;
 
  const title = currentPageOnly
    ? `${project.name || "Notebook"} — ${page.name || "Page"}`
    : `${project.name || "Notebook"} — Whole Project`;
 
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    setStatus("Allow popups, then try PDF export again.");
    return;
  }
  printWindow.document.write("<p style='font-family:system-ui;padding:24px'>Preparing PDF pages...</p>");
 
  const exportPages = [];
  for (const item of pagesToExport) {
    const canvas = await createPageExportCanvas(2, item);
    if (canvas) {
      exportPages.push({
        projectName: project.name || "Notebook",
        pageName: item.name || "Page",
        dataUrl: canvas.toDataURL("image/png"),
      });
    }
  }
 
  writePdfDocument(printWindow, title, exportPages);
  state.exportMenuOpen = false;
  renderToolbarState();
  setStatus(currentPageOnly ? "PDF export opened for this page. Choose Save as PDF." : "PDF export opened for the whole project. Choose Save as PDF.");
}
 
function openPdfChoiceModal() {
  const project = getSelectedProject();
  if (!project) return;
 
  if (project.pages.length <= 1) {
    exportPageAsPdf("page");
    return;
  }
 
  DOM.pdfChoiceModal.hidden = false;
  state.exportMenuOpen = false;
  renderToolbarState();
}
 
function closePdfChoiceModal() {
  DOM.pdfChoiceModal.hidden = true;
}
 
function uploadPictureToPage(file) {
  const page = getCurrentPage();
  if (!page || !file) return;
  if (!file.type.startsWith("image/")) {
    setStatus("Please upload an image file.");
    return;
  }
 
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const { width: pageWidth, height: pageHeight } = getUnzoomedPageSize();
      const maxWidth = pageWidth * 0.6;
      const maxHeight = pageHeight * 0.6;
      let width = img.width;
      let height = img.height;
      const ratio = width / height;
      if (width > maxWidth) {
        width = maxWidth;
        height = width / ratio;
      }
      if (height > maxHeight) {
        height = maxHeight;
        width = height * ratio;
      }
 
      page.backgroundImage = {
        dataUrl: reader.result,
        name: file.name,
        x: (pageWidth - width) / 2,
        y: (pageHeight - height) / 2,
        width,
        height,
        fit: "manual",
      };
      page.redoStack = [];
      saveNow();
      renderAll();
      setMode("move");
      setStatus("Picture added. Drag to move, drag corners to resize.");
    };
    img.src = reader.result;
  };
  reader.onerror = () => setStatus("Could not read that picture.");
  reader.readAsDataURL(file);
}
 
function removePagePicture() {
  const page = getCurrentPage();
  if (!page?.backgroundImage) {
    setStatus("No picture on this page.");
    return;
  }
  page.backgroundImage = null;
  saveNow();
  renderAll();
  setStatus("Picture removed. Your handwriting stayed on the page.");
}
 
function toggleExportMenu() {
  state.exportMenuOpen = !state.exportMenuOpen;
  renderToolbarState();
}
 
function startStroke(event) {
  if (state.mode === "move") return;
  if (event.button === 2) return; // right-click is handled separately as eraser
  if (event.button !== 0 && event.pointerType !== "pen") return;
  const page = getSelectedPage();
  if (!page) return;
 
  event.preventDefault();
  DOM.board.setPointerCapture(event.pointerId);
  playStrokeStart();
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
  const { x, y } = getUnzoomedPointer(event, DOM.board);
  const pressure = event.pressure && event.pressure > 0 ? event.pressure : event.pointerType === "pen" ? 0.65 : 0.5;
  return {
    x,
    y,
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
 
function extractSolidColor(cssColor, fallback = "#888") {
  // Pull rgb values out of rgba(...) and return a solid version at full opacity
  const m = cssColor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return `rgb(${m[1]},${m[2]},${m[3]})`;
  return cssColor || fallback;
}

function renderPalettePicker() {
  const active = getPalette(state.selectedPaletteId);
  if (DOM.paletteActiveName) DOM.paletteActiveName.textContent = active.name;

  if (DOM.paletteMenu) {
    DOM.paletteMenu.innerHTML = PALETTES.map((palette) => {
      const isActive = palette.id === state.selectedPaletteId;
      const s1 = palette.bg;
      const s2 = extractSolidColor(palette.line);
      const s3 = extractSolidColor(palette.margin);
      const s4 = extractSolidColor(palette.border);
      return `
        <button class="palette-card ${isActive ? "is-active" : ""}" data-action="select-palette" data-palette-id="${palette.id}" data-tooltip="${escapeHtml(palette.name)}">
          <span class="palette-meta"><span class="palette-title">${escapeHtml(palette.name)}</span><span class="palette-dot">${isActive ? "✨" : ""}</span></span>
          <span class="palette-samples">
            <span class="sample" style="background:${s1}"></span>
            <span class="sample" style="background:${s2}"></span>
            <span class="sample" style="background:${s3}"></span>
            <span class="sample" style="background:${s4}"></span>
          </span>
        </button>`;
    }).join("");
    DOM.paletteMenu.hidden = !state.paletteMenuOpen;
  }

  if (DOM.paletteToggleBtn) {
    DOM.paletteToggleBtn.classList.toggle("is-active", state.paletteMenuOpen);
    DOM.paletteToggleBtn.setAttribute("aria-expanded", String(state.paletteMenuOpen));
  }
}

function togglePaletteMenu(force) {
  state.paletteMenuOpen = typeof force === "boolean" ? force : !state.paletteMenuOpen;
  renderPalettePicker();
}
 
function renderColorSwatches() {
  DOM.colorSwatches.innerHTML = INK_COLORS
    .map(
      (color) => `
        <button class="color-swatch ${state.selectedColor === color ? "is-active" : ""}" data-action="select-color" data-color="${color}" data-tooltip="${color}" style="--swatch:${color}"></button>`,
    )
    .join("");
}
 
function renderToolbarState() {
  const project = getSelectedProject();
  const page = getSelectedPage();
  DOM.projectTitle.textContent = project ? project.name : "No project";
  DOM.pageTitle.textContent = page ? page.name : "No page";
  DOM.brushSize.value = String(state.brushSize);
  if (DOM.zoomSlider) DOM.zoomSlider.value = String(state.zoomPercent);
  if (DOM.zoomValue) DOM.zoomValue.textContent = `${state.zoomPercent}%`;
  if (DOM.toolSelect) DOM.toolSelect.value = (state.mode === "eraser" || state.mode === "move") ? "pen" : state.mode;
  DOM.penBtn.classList.toggle("is-active", state.mode !== "eraser" && state.mode !== "move");
  DOM.eraserBtn.classList.toggle("is-active", state.mode === "eraser");
  const moveBtn = document.getElementById("moveBtn");
  if (moveBtn) moveBtn.classList.toggle("is-active", state.mode === "move");
  const alignControls = document.getElementById("alignControls");
  if (alignControls) alignControls.hidden = !(state.mode === "move" && page?.backgroundImage);
  if (DOM.removeImageBtn) DOM.removeImageBtn.disabled = !page?.backgroundImage;
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
  renderImageLayer();
  renderCanvas();
}
 
function handleSidebarClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  const projectId = button.dataset.projectId;
  const pageId = button.dataset.pageId;
  playSelect();
 
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
  playClick();
  if (action === "sound-toggle") {
    const muted = toggleMuted();
    renderSoundToggleState();
    setStatus(muted ? "Sound muted." : "Sound on.");
    return;
  }
  if (action === "sidebar-toggle") toggleSidebar();
  if (action === "new-project") createProject();
  if (action === "new-page") createPage();
  if (action === "pen") setMode("pen");
  if (action === "move") setMode("move");
  if (action === "eraser") setMode("eraser");
  if (action === "align-left") alignImage("left");
  if (action === "align-center") alignImage("center");
  if (action === "align-right") alignImage("right");
  if (action === "undo") undoStroke();
  if (action === "redo") redoStroke();
  if (action === "save") {
    saveNow();
    setStatus("Saved locally.");
  }
  if (action === "upload-image") DOM.pictureInput?.click();
  if (action === "remove-image") removePagePicture();
  if (action === "theme-toggle") toggleTheme();
  if (action === "export") toggleExportMenu();
  if (action === "toggle-palette") togglePaletteMenu();
  if (action === "export-png") exportPageAsPng();
  if (action === "export-pdf") openPdfChoiceModal();
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
 
  DOM.toolSelect?.addEventListener("change", (event) => {
    playSelect();
    setMode(event.target.value);
  });
 
  DOM.brushSize.addEventListener("input", (event) => {
    state.brushSize = Number(event.target.value);
    scheduleSave();
  });

  DOM.zoomSlider?.addEventListener("input", (event) => {
    setZoomPercent(Number(event.target.value));
  });
 
  DOM.pictureInput?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    uploadPictureToPage(file);
    event.target.value = "";
  });
 
  DOM.pdfThisPageBtn?.addEventListener("click", () => {
    playClick();
    closePdfChoiceModal();
    exportPageAsPdf("page");
  });
 
  DOM.pdfWholeProjectBtn?.addEventListener("click", () => {
    playClick();
    closePdfChoiceModal();
    exportPageAsPdf("project");
  });
 
  DOM.pdfCancelBtn?.addEventListener("click", () => {
    playClick();
    closePdfChoiceModal();
  });
 
  // ── Drawing events ──────────────────────────────────────────────────────────
  DOM.board.addEventListener("pointerdown", startStroke);
  DOM.board.addEventListener("pointermove", extendStroke);
  DOM.board.addEventListener("pointerup", finishStroke);
  DOM.board.addEventListener("pointercancel", finishStroke);
  DOM.board.addEventListener("lostpointercapture", finishStroke);
 
  // Block browser context menu on the canvas so right-click eraser works
  DOM.board.addEventListener("contextmenu", (event) => event.preventDefault());
 
  // ── Right-click = temporary eraser ─────────────────────────────────────────
  DOM.board.addEventListener("pointerdown", (event) => {
    if (event.button !== 2) return;
    event.preventDefault();
    state._prevMode = state.mode;
    // Silently switch to eraser (skip setMode's scheduleSave/setStatus noise)
    state.mode = "eraser";
    // Kick off an eraser stroke immediately
    startStroke({ ...event, button: 0 });
  });
 
  DOM.board.addEventListener("pointerup", (event) => {
    if (event.button !== 2 || state._prevMode === undefined) return;
    finishStroke({ ...event, pointerId: state.activePointerId ?? event.pointerId });
    state.mode = state._prevMode;
    delete state._prevMode;
    renderToolbarState();
    setStatus(`${TOOL_PRESETS[state.mode]?.label ?? state.mode} restored.`);
  });
  // ───────────────────────────────────────────────────────────────────────────
 
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
    if (state.paletteMenuOpen && !event.target.closest(".palette-menu") && !event.target.closest("[data-toolbar-action='toggle-palette']")) {
      state.paletteMenuOpen = false;
      renderPalettePicker();
    }
    if (changed) renderAllSidebar();
  });
 
  window.addEventListener("resize", () => {
    resizeCanvas();
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
  renderSoundToggleState();
  renderAll();
  applyZoom();
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
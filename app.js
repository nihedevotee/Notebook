const STORAGE_KEY = "simple-notebook-workspace-v1";

const PALETTES = [
  { id: "soft-pastel", name: "Soft Pastel", colors: ["#5b6cff", "#ff8fb1", "#7dd3fc", "#f6c177"] },
  { id: "warm-coffee", name: "Warm Coffee", colors: ["#3f2d20", "#8b5e34", "#d4a373", "#f5e6ca"] },
  { id: "dark-academic", name: "Dark Academic", colors: ["#0f172a", "#334155", "#64748b", "#cbd5e1"] },
  { id: "blue-notebook", name: "Blue Notebook", colors: ["#0f4c81", "#3b82f6", "#93c5fd", "#dbeafe"] },
  { id: "nature-green", name: "Nature Green", colors: ["#14532d", "#2f855a", "#84cc16", "#dcfce7"] },
  { id: "sunset", name: "Sunset", colors: ["#b91c1c", "#f97316", "#fb7185", "#fde68a"] },
  { id: "minimal-black", name: "Minimal Black", colors: ["#111827", "#374151", "#6b7280", "#e5e7eb"] },
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
  penBtn: document.getElementById("penBtn"),
  eraserBtn: document.getElementById("eraserBtn"),
  undoBtn: document.getElementById("undoBtn"),
  redoBtn: document.getElementById("redoBtn"),
  beautifyBtn: document.getElementById("beautifyBtn"),
  saveBtn: document.getElementById("saveBtn"),
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
  selectedColor: "#1f2937",
  brushSize: 4,
  mode: "pen",
  sidebarOpen: true,
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
  return {
    mode: stroke.mode === "eraser" ? "eraser" : "pen",
    color: stroke.color,
    size: Number(stroke.size) || 4,
    beautified: Boolean(stroke.beautified),
    points: Array.isArray(stroke.points) ? stroke.points.map(clonePoint) : [],
  };
}

function createDefaultPage(name = "Page 1") {
  return {
    id: uid("page"),
    name,
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
    for (const page of project.pages) {
      page.strokes = Array.isArray(page.strokes) ? page.strokes.map(cloneStroke) : [];
      page.redoStack = Array.isArray(page.redoStack) ? page.redoStack.map(cloneStroke) : [];
    }
    project.expanded = Boolean(project.expanded);
  }

  if (!state.projects.some((project) => project.id === state.selectedProjectId)) {
    state.selectedProjectId = state.projects[0].id;
  }

  const project = getSelectedProject();
  if (!project.pages.some((page) => page.id === state.selectedPageId)) {
    state.selectedPageId = project.pages[0].id;
  }

  if (!PALETTES.some((palette) => palette.id === state.selectedPaletteId)) {
    state.selectedPaletteId = PALETTES[0].id;
  }

  const palette = getPalette(state.selectedPaletteId);
  if (!palette.colors.includes(state.selectedColor)) {
    state.selectedColor = palette.colors[0];
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

function loadWorkspace() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      state.projects = [createDefaultProject()];
      state.selectedProjectId = state.projects[0].id;
      state.selectedPageId = state.projects[0].pages[0].id;
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
  } catch {
    state.projects = [createDefaultProject()];
    state.selectedProjectId = state.projects[0].id;
    state.selectedPageId = state.projects[0].pages[0].id;
    state.sidebarOpen = window.innerWidth > 980;
  }

  ensureWorkspace();
}

function getCurrentPalette() {
  return getPalette(state.selectedPaletteId);
}

function setActivePalette(id) {
  state.selectedPaletteId = id;
  const palette = getPalette(id);
  if (!palette.colors.includes(state.selectedColor)) {
    state.selectedColor = palette.colors[0];
  }
  scheduleSave();
  renderAll();
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

function shouldStorePoint(previous, nextPoint) {
  if (!previous) return true;
  return Math.hypot(nextPoint.x - previous.x, nextPoint.y - previous.y) >= Math.max(0.5, state.brushSize * 0.08);
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
        x: previous.x * 0.2 + point.x * 0.6 + after.x * 0.2,
        y: previous.y * 0.2 + point.y * 0.6 + after.y * 0.2,
        pressure: previous.pressure * 0.2 + point.pressure * 0.6 + after.pressure * 0.2,
        time: point.time,
      });
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function renderStroke(stroke, targetContext = context) {
  const points = smoothPoints(stroke.points, stroke.beautified ? 3 : 1);
  if (!points.length) return;

  targetContext.save();
  targetContext.globalCompositeOperation = stroke.mode === "eraser" ? "destination-out" : "source-over";
  targetContext.lineCap = "round";
  targetContext.lineJoin = "round";
  targetContext.strokeStyle = stroke.color;
  targetContext.fillStyle = stroke.color;

  const baseWidth = stroke.mode === "eraser" ? stroke.size * 2.4 : stroke.size;
  const avgPressure = points.reduce((sum, point) => sum + (point.pressure ?? 0.5), 0) / points.length;
  targetContext.lineWidth = Math.max(1, baseWidth * (0.82 + avgPressure * 0.45));

  if (points.length === 1) {
    const point = points[0];
    targetContext.beginPath();
    targetContext.arc(point.x, point.y, targetContext.lineWidth / 2, 0, Math.PI * 2);
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
    const next = midpoint(current, points[index + 1]);
    targetContext.quadraticCurveTo(current.x, current.y, next.x, next.y);
  }
  const last = points[points.length - 1];
  targetContext.lineTo(last.x, last.y);
  targetContext.stroke();
  targetContext.restore();
}

function renderPaperBackground(targetContext, width, height) {
  targetContext.save();
  targetContext.fillStyle = "#fffdf6";
  targetContext.fillRect(0, 0, width, height);
  targetContext.fillStyle = "rgba(183, 58, 58, 0.14)";
  targetContext.fillRect(70, 0, 1.2, height);
  targetContext.strokeStyle = "rgba(63, 98, 148, 0.12)";
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
    renderAll();
  });
}

function applyBeautifyToStroke(stroke) {
  if (stroke.mode !== "pen" || stroke.points.length < 2) {
    return cloneStroke(stroke);
  }
  return {
    ...cloneStroke(stroke),
    beautified: true,
    points: smoothPoints(stroke.points, 3),
  };
}

function beautifyCurrentPage() {
  const page = getCurrentPage();
  if (!page) return;
  page.strokes = page.strokes.map(applyBeautifyToStroke);
  page.redoStack = [];
  scheduleSave();
  renderAll();
  setStatus("Creamy Handwriting applied.");
}

function redrawWithPaper(targetContext, width, height, strokes) {
  renderPaperBackground(targetContext, width, height);
  for (const stroke of strokes) {
    renderStroke(stroke, targetContext);
  }
}

function exportCurrentPage() {
  const page = getCurrentPage();
  if (!page) return;
  const rect = DOM.board.getBoundingClientRect();
  const ratio = Math.max(2, window.devicePixelRatio || 1);
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = Math.max(1, Math.floor(rect.width * ratio));
  exportCanvas.height = Math.max(1, Math.floor(rect.height * ratio));
  const exportContext = exportCanvas.getContext("2d");
  exportContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  redrawWithPaper(exportContext, rect.width, rect.height, page.strokes);
  const link = document.createElement("a");
  link.href = exportCanvas.toDataURL("image/png");
  link.download = `${(page.name || "notebook-page").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase()}.png`;
  link.click();
  setStatus("Page exported as PNG.");
}

function startStroke(event) {
  if (event.button !== 0 && event.pointerType !== "pen") return;
  const page = getCurrentPage();
  if (!page) return;

  event.preventDefault();
  DOM.board.setPointerCapture(event.pointerId);
  state.isDrawing = true;
  state.activePointerId = event.pointerId;
  state.activeStroke = {
    mode: state.mode,
    color: state.mode === "eraser" ? "#ffffff" : state.selectedColor,
    size: state.brushSize,
    beautified: false,
    points: [getPoint(event)],
  };
  page.strokes.push(state.activeStroke);
  page.redoStack = [];
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

function extendStroke(event) {
  if (!state.isDrawing || state.activePointerId !== event.pointerId || !state.activeStroke) return;
  event.preventDefault();
  const nextPoint = getPoint(event);
  const points = state.activeStroke.points;
  const lastPoint = points[points.length - 1];
  if (shouldStorePoint(lastPoint, nextPoint)) {
    points.push(nextPoint);
  } else {
    points[points.length - 1] = nextPoint;
  }
  queueRender();
}

function finishStroke(event) {
  if (!state.isDrawing || state.activePointerId !== event.pointerId) return;
  state.isDrawing = false;
  state.activePointerId = null;
  state.activeStroke = null;
  scheduleSave();
  renderAll();
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
                    <span class="page-indicator"></span>
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
        <span class="palette-title">${escapeHtml(palette.name)}</span>
        <span class="palette-samples">
          ${palette.colors.map((color) => `<span class="sample" style="background:${color}"></span>`).join("")}
        </span>
      </button>`;
  }).join("");
}

function renderColorSwatches() {
  const palette = getCurrentPalette();
  DOM.colorSwatches.innerHTML = palette.colors
    .map(
      (color) => `
        <button class="color-swatch ${state.selectedColor === color ? "is-active" : ""}" data-action="select-color" data-color="${color}" title="${color}" style="--swatch:${color}"></button>`,
    )
    .join("");
}

function renderToolbarState() {
  const project = getSelectedProject();
  const page = getCurrentPage();
  DOM.projectTitle.textContent = project ? project.name : "No project";
  DOM.pageTitle.textContent = page ? page.name : "No page";
  DOM.brushSize.value = String(state.brushSize);
  DOM.penBtn.classList.toggle("is-active", state.mode === "pen");
  DOM.eraserBtn.classList.toggle("is-active", state.mode === "eraser");
  DOM.appShell.classList.toggle("sidebar-open", state.sidebarOpen);
}

function renderAllSidebar() {
  renderProjectList();
  renderPalettePicker();
  renderToolbarState();
}

function renderAll() {
  ensureWorkspace();
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
  if (action === "export") exportCurrentPage();
  if (action === "clear") clearCurrentPage();
}

function initEvents() {
  DOM.sidebar.addEventListener("click", handleSidebarClick);
  DOM.appShell.addEventListener("click", handleToolbarClick);
  DOM.scrim.addEventListener("click", () => toggleSidebar(false));
  DOM.sidebarToggle.addEventListener("click", () => toggleSidebar());
  DOM.newProjectBtn.addEventListener("click", createProject);
  DOM.newPageBtn.addEventListener("click", () => createPage());

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
    if (event.target.closest(".menu-button") || event.target.closest(".menu-popover")) return;
    if (state.menu) {
      state.menu = null;
      renderAllSidebar();
    }
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
  renderAll();
  resizeCanvas();
  setStatus(state.projects.length ? "Workspace loaded." : "Autosaves locally in this browser.");
  setMode(state.mode);
}

// Future AI hooks:
// - Replace beautifyCurrentPage() with a handwriting beautification model.
// - Add handwriting recognition for searchable notes.
// - Learn the user's personal writing style and recreate it cleanly.
// - Transform rough stroke input into personalized clean handwriting.

boot();

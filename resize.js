// resize.js — handles image drag + corner resizing
const HANDLE_HIT = 12;
const HANDLE_SIZE = 8;

let imageInteraction = {
  active: false,
  mode: null,
  handle: null,
  startX: 0,
  startY: 0,
  origX: 0,
  origY: 0,
  origWidth: 0,
  origHeight: 0,
  origAspect: 1,
};

export function getImageHandles(img) {
  return [
    { name: "nw", x: img.x, y: img.y },
    { name: "ne", x: img.x + img.width, y: img.y },
    { name: "sw", x: img.x, y: img.y + img.height },
    { name: "se", x: img.x + img.width, y: img.y + img.height },
  ];
}

export function getHitHandle(img, x, y) {
  return getImageHandles(img).find(
    (h) => Math.abs(h.x - x) <= HANDLE_HIT && Math.abs(h.y - y) <= HANDLE_HIT
  ) || null;
}

export function isInsideImage(img, x, y) {
  return x >= img.x && x <= img.x + img.width && y >= img.y && y <= img.y + img.height;
}

export function initImageInteraction(DOM, getCurrentPage, renderImageLayer, saveNow) {
  const layer = DOM.imageLayer;

  layer.addEventListener("pointerdown", (event) => {
    const page = getCurrentPage();
    if (!page?.backgroundImage || DOM.mode !== "move") return;
    event.preventDefault();
    const rect = layer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const img = page.backgroundImage;
    const handle = getHitHandle(img, x, y);

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
    if (!handle) layer.style.cursor = "grabbing";
  });

  layer.addEventListener("pointermove", (event) => {
    const page = getCurrentPage();
    if (!page?.backgroundImage) return;
    const img = page.backgroundImage;
    if (!imageInteraction.active) return;

    const rect = layer.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
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

  layer.addEventListener("pointerup", () => {
    if (!imageInteraction.active) return;
    imageInteraction.active = false;
    imageInteraction.mode = null;
    saveNow();
    renderImageLayer();
  });

  layer.addEventListener("pointercancel", () => {
    imageInteraction.active = false;
    imageInteraction.mode = null;
  });
}
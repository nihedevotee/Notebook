# Notebook Workspace
 
A web-based notebook app for writing, sketching, and organizing notes into projects and pages — with a polished drawing engine, per-page paper themes, image support, and flexible export options.
 
## Features
 
### Projects & Pages
* Create and manage multiple projects
* Add multiple pages inside each project
* Rename or delete projects and pages via context menus in the sidebar
* Projects expand and collapse in the sidebar
* Auto-generated unique emoji icon per project for quick visual identification
### Drawing Tools
* Six brush types: Pen, Brush, Oil Pastel, Marker, Pencil, and Highlighter
* Each tool has tuned opacity, width multiplier, smoothing passes, and composite mode
* Adjustable brush size via a slider (1–28 px)
* Ink color selector with five preset colors
* Eraser tool with an enlarged hit area
* Right-click anywhere on the canvas for a quick temporary eraser — releases back to your previous tool automatically
### Ink Engine
* Pressure-sensitive stroke width (uses pointer pressure when available)
* Speed-based width variation — faster strokes get slightly thinner
* Live stroke smoothing during drawing
* Stroke beautification pass on completion: smooths, simplifies, and straightens near-straight lines
* Row normalization that nudges misaligned handwriting rows toward a consistent baseline
* Textured rendering for Oil Pastel and Pencil (dual-pass jitter)
* Highlighter uses multiply composite for realistic layering
### Canvas & Zoom
* Zoom control (75%–150%, in 5% steps) via a slider — zoom is saved per session
* Canvas resizes responsively with the window via ResizeObserver
* Zoom-aware pointer coordinate handling so drawing stays accurate at any zoom level
### Image Support
* Upload a picture onto any page and write on top of it
* Uploaded image auto-fits to roughly 60% of the page on upload, centered
* Move mode (✋ Move button) lets you drag the image freely on the canvas
* Corner handles (NW, NE, SW, SE) for proportional resize — aspect ratio is locked
* Align image left, center, or right with one click
* Remove picture without erasing any handwriting
* Image position and size are saved and restored per page
* Images are correctly composited into PNG and PDF exports at the user-set position and size
### Paper Themes
Six built-in palettes, each setting paper color, rule line color, margin line color, border, shadow, and texture:
* Soft Pastel
* Warm Coffee
* Dark Academic
* Forest Night
* Ocean Study
* Minimal Black
Each page stores its own theme, so different pages in the same project can have different looks.
 
### Light / Dark Mode
* App-level dark mode toggle (🌙 / ☀️)
* Theme preference is saved separately from workspace data and persists across sessions
### Undo / Redo
* Undo and redo strokes per page
* Undo stack clears on page clear; redo stack clears on new stroke
### Save & Autosave
* Workspace autosaves to browser localStorage after every interaction (120 ms debounce)
* Manual Save button for an immediate save
* Status bar confirms save and other actions, auto-resets after 1.8 s
### Export
* **Save as PNG** — exports the current page as a high-resolution PNG (A4 proportions, 2× pixel ratio)
* **PDF — this page only** — opens a print-ready A4 layout for the current page with project name, page name, page number, and date stamp in the header
* **PDF — whole project** — exports all pages in the current project as one multi-page PDF document
* PDF layout uses the browser print dialog; choose **Save as PDF** when the print window opens
* Export skips the choice modal and goes straight to PDF when the project has only one page
### Sidebar
* Collapsible sidebar with toggle button and scrim overlay on narrow screens
* Sidebar closes automatically on mobile when a page is selected
* Sidebar state (open/closed) is saved with the workspace
## Tech Stack
 
* HTML, CSS, JavaScript (ES modules)
* Node.js (built-in `http` and `fs` modules — no npm dependencies required)
## Live Demo

The app is deployed and publicly accessible at:

**https://notebook-seven-omega.vercel.app/**

No sign-up or installation needed — just open the link in any browser.

## Project Files
 
```
notebook-app/
├── index.html
├── styles.css
├── app.js
├── resize.js
├── server.js
├── package.json
├── vercel.json
└── README.md
```
 
## Notes & Future Plans
 
Data is stored in the browser via localStorage. Future improvements may include:
 
* Login and cloud sync
* Database-backed storage
* Real AI / ML handwriting cleanup (hooks already stubbed in the codebase)
* Handwriting recognition for searchable notes
* Learning and recreating a user's personal writing style

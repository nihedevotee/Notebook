# Notebook Workspace

A simple web-based notebook app for writing, sketching, and organizing notes into projects and pages.

## Features

* Create multiple projects
* Add multiple pages inside each project
* Write or draw on a notebook-style canvas
* Use pen, brush, oil pastel, marker, pencil, highlighter, and eraser
* Change ink color and brush size
* Refine handwriting with basic smoothing
* Upload a picture and write on top of it
* Remove uploaded picture without deleting handwriting
* Undo and redo strokes
* Light/dark mode
* Collapsible sidebar
* Notebook paper palettes
* Autosave locally in the browser

## Export Options

* Save current page as PNG
* Download PDF of this page only
* Download PDF of the whole project
* Cancel PDF export

PDF export uses the browser print dialog. Choose **Save as PDF** when the print window opens.

## Tech Used

* HTML
* CSS
* JavaScript
* Node.js

## How to Run

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm start
```

Open in browser:

```text
http://localhost:3000
```

## Port Already in Use Error

If you see:

```text
EADDRINUSE: address already in use :::3000
```

It means the app is already running. Open:

```text
http://localhost:3000
```

To stop it in PowerShell:

```powershell
netstat -ano | findstr :3000
taskkill /PID YOUR_PID_HERE /F
```

Then start again:

```bash
npm start
```

## Project Files

```text
notebook-app/
├── index.html
├── styles.css
├── app.js
├── server.js
├── package.json
└── README.md
```

## Notes

This is still an early version. It currently saves data in the browser using local storage. Future improvements may include login, database storage, cloud sync, better image editing, and real AI handwriting cleanup.

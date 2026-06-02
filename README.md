# Simple Notebook

Simple Notebook is a small web-based writing app made for people who like writing on a PC, especially with a mouse or pen tablet.

I made this because I wanted a clean digital notebook where I can write freely, sketch quick ideas, and practice handwriting without needing a heavy app. It is simple right now, but I plan to keep improving it over time and make the writing experience smoother, more natural, and more comfortable.

## What it can do

* Write or draw on a notebook-style page
* Choose different ink colors
* Change brush size
* Use pen and eraser tools
* Undo and redo strokes
* Save writing locally in the browser
* Export the notebook page as a PNG image
* Use a basic “Creamy Handwriting” feature to smooth rough strokes

## Why I made it

I wanted something that feels like a simple digital notebook for pen tablet users. Most note apps feel either too complicated or too heavy, so this project is my attempt to build a lightweight notebook that feels easy and comfortable to use.

The current version is still basic, but it already works for simple handwriting and sketching. Over time, I want to improve the smoothness of the strokes and make the writing feel closer to real handwriting on paper.

## Future plans

I want to improve this project step by step. Some things I may add later:

* Better handwriting smoothness
* More natural pen pressure
* Multiple notebook pages
* Better save system
* Better eraser
* Dark mode
* Real AI-assisted handwriting cleanup
* A more polished notebook interface

## How to run

First, install dependencies:

```bash
npm install
```

Then start the app:

```bash
npm start
```

Open this in your browser:

```text
http://localhost:3000
```

## Tech used

* HTML
* CSS
* JavaScript
* Node.js

## Note

This is still an early version. I will keep improving it over time and make it smoother, cleaner, and more useful for people who like writing with a pen tablet or directly on their PC.

## Latest UI refinement

This version adds:

* Polished light/dark mode with a toolbar toggle
* ChatGPT-style collapsible sidebar with desktop collapse and mobile overlay behavior
* Compact rounded Color Hunt-style palette cards
* Emoji avatars for projects and pages
* Export dropdown with:
  * Download as PDF using the browser print dialog / Save as PDF
  * High-resolution PNG export for the current notebook page
* Softer spacing, shadows, rounded corners, and modern SaaS-style visual polish


## Added in this update

* PDF export now asks whether to export only the current page or the whole project when the current project has multiple pages.
* Added multiple writing tools: Pen, Brush, Oil Pastel, Marker, Pencil, and Highlighter.
* Added picture upload for a notebook page. The picture sits under the canvas, so you can write directly over the picture area.
* PNG and PDF exports include the uploaded picture and the handwriting on top.

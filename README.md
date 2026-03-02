# Braille Label Generator

Generate **braille labels** as 3D models (STL) for printing: a **rectangular flat base** with **semi-sphere dots** for each braille character. Supports **multi-line text** (line breaks), configurable thickness, cell size, padding, and dot size.

## Features

- **Text input**: A–Z, a–z, 0–9 (with number sign), spaces; **line breaks** create new lines.
- **Output**: One STL = flat rectangular plate + hemisphere dots on top.
- **Parameters**: Label thickness, **cell height** (cell width follows standard 2:3 ratio), padding, line spacing, dot diameter (or auto).

## Setup

```bash
npm install
```

## Usage

### CLI (Node)

**Single label:**
```bash
npm run braille -- --text "Hello" --output output/label.stl
npm run braille -- --text "Line one\nLine two" --thickness 2 --padding 3 --output output/label.stl
```

**Batch from JSON array:**
```bash
npm run braille -- --input labels.json [--output-dir output]
```

The JSON file must be an array. Each element is either a string (the text) or an object with `"text"` and optional `"output"`, `"name"`, and label params (`labelThickness`, `cellHeight`, `padding`, `lineSpacing`, `dotDiameter`). See `labels.example.json` for a sample.

Options: `--text`, `--input`, `--output`, `--output-dir`, `--name`, `--thickness`, `--cell-height`, `--padding`, `--line-spacing`, `--dot-diameter`. Run with `--help` for full list.

### Web

Open **`web/index.html`** in a browser. Enter text (with line breaks), set thickness, cell size, padding, and optional dot diameter, then click **Generate STL**.  
To publish: `npm run build-web` and use the `docs/` folder (e.g. GitHub Pages).

## Project structure

- **`src/core/braille.js`** – Braille encoding, layout, and geometry (JSCad); used by CLI.
- **`src/cli/braille.js`** – CLI for text + params → STL.
- **`web/index.html`** + **`web/main.js`** – Browser UI and dependency-free STL generation.

## License

MIT – see [LICENSE](LICENSE).

# Braille Label Generator

Generate **braille labels** as 3D models (STL) for printing: a flat rectangular base with **hemisphere dots** for each character. Supports multi-line text, numbers (with number sign), and configurable size and spacing.

HTML generator:
You can use our html single label generator:
https://michalmietlinski.github.io/braille-label-generator/

## Features

- **Text**: A–Z, a–z, 0–9 (number sign + digit), spaces; **line breaks** = new lines.
- **Output**: One STL = rectangular plate + dome dots on top (hemispheres, not full spheres).
- **Params**: Label thickness, cell height (width = height × 2/3), padding, line spacing, dot diameter (optional).

## Setup

```bash
npm install
```

## Usage

### CLI

**Single label:**
```bash
npm run braille -- --text "Hello" --output output/label.stl
npm run braille -- --text "Line one\nLine two" --thickness 2 --padding 3
```

**Batch from JSON:**
```bash
npm run braille -- --input labels.json [--output-dir output]
```

JSON = array of strings (text) or objects with `"text"` and optional `"output"`, `"name"`, `labelThickness`, `cellHeight`, `padding`, `lineSpacing`, `dotDiameter`. Example: `labels.example.json`.

**Examples (generates 3 STLs to output/):**
```bash
npm run example
```

### Web

- **Develop**: Open `web/index.html` in a browser.
- **Build for deploy**: `npm run build-web` → copies `web/index.html` and `web/main.js` to **`docs/`**. Use the `docs/` folder as the source for GitHub Pages.

## Project structure

| Path | Description |
|------|-------------|
| `src/core/braille.js` | Braille encoding (letters + number sign + digits), layout, geometry (JSCad). |
| `src/cli/braille.js` | CLI: `--text` or `--input` JSON → STL. |
| `web/index.html`, `web/main.js` | Browser UI; no deps, outputs STL in-browser. |
| `tools/build_web.js` | Copies web assets to `docs/` (for GitHub Pages). |
| `example.js` | Runs 3 example texts → `output/*.stl`. |
| `labels.example.json` | Sample JSON array for batch. |

## License

MIT – see [LICENSE](LICENSE).

/**
 * CLI: generate braille label STL from text or from a JSON file (array of labels).
 * Usage:
 *   node src/cli/braille.js --text "hello" [--output output/label.stl] [params]
 *   node src/cli/braille.js --input labels.json [--output-dir output] [params]
 */

import fs from "node:fs/promises";
import path from "node:path";
import { buildLabelStl } from "../core/braille.js";

function printHelp() {
  console.log(`
Braille Label Generator (CLI)

Usage (single label):
  node src/cli/braille.js --text "Your text here" [options]

Usage (batch from JSON array):
  node src/cli/braille.js --input <file.json> [--output-dir output] [options]

Required (single):  --text <string>    Text to render in braille (line breaks allowed)
Required (batch):   --input <path>     JSON file: array of strings or { "text", "output?", "name?", ... }

Output (single):
  --output <path>    Output STL path (default: output/braille-label.stl)
  --name <string>    STL solid name (default: braille-label)

Output (batch):
  --output-dir <dir> Directory for STL files (default: output). Each item may set "output": "file.stl".

Label parameters (mm, used as defaults; batch items can override):
  --thickness <n>      Base plate thickness (default: 2)
  --cell-height <n>   Height of one braille cell (default: 10). Width = height × 2/3 (standard).
  --padding <n>       Margin around content (default: 2)
  --line-spacing <n>  Vertical gap between lines (default: 0)
  --dot-diameter <n>  Diameter of each raised dot (default: auto)

JSON array format:
  [ "Hello", "Line one\\nLine two", { "text": "Room 42", "output": "room.stl" } ]
  Each element: string (text only) or object with "text" and optional "output", "name", "labelThickness", "cellHeight", "padding", "lineSpacing", "dotDiameter".

Examples:
  node src/cli/braille.js --text "Hello\\nWorld" --output output/hello.stl
  node src/cli/braille.js --input labels.json --output-dir output
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (key === "help") {
      args.help = true;
      continue;
    }
    const value = argv[i + 1];
    if (value == null || value.startsWith("--")) {
      throw new Error(`Missing value for --${token.slice(2)}`);
    }
    args[key] = value;
    i++;
  }
  return args;
}

function toNum(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function getDefaultParams(args) {
  return {
    labelThickness: toNum(args.thickness, 2),
    cellHeight: toNum(args.cellHeight, 10),
    padding: toNum(args.padding, 2),
    lineSpacing: Math.max(0, toNum(args.lineSpacing, 0)),
    dotDiameter: args.dotDiameter != null ? toNum(args.dotDiameter, undefined) : undefined,
  };
}

function normalizeText(s) {
  return String(s ?? "").replace(/\\n/g, "\n");
}

async function runBatch(args, defaultParams, outputDir) {
  const raw = await fs.readFile(args.input, "utf8");
  let arr;
  try {
    arr = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Invalid JSON in ${args.input}: ${e.message}`);
  }
  if (!Array.isArray(arr)) {
    throw new Error("JSON file must contain an array.");
  }

  await fs.mkdir(outputDir, { recursive: true });

  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    const text = typeof item === "string" ? item : item?.text;
    if (text == null || String(text).trim() === "") {
      console.warn(`Item ${i + 1}: missing or empty text, skipping.`);
      continue;
    }
    const normalizedText = normalizeText(text);
    const params = { ...defaultParams };
    if (typeof item === "object" && item !== null) {
      if (item.labelThickness != null) params.labelThickness = Number(item.labelThickness);
      if (item.cellHeight != null) params.cellHeight = Number(item.cellHeight);
      if (item.padding != null) params.padding = Number(item.padding);
      if (item.lineSpacing != null) params.lineSpacing = Math.max(0, Number(item.lineSpacing));
      if (item.dotDiameter != null) params.dotDiameter = Number(item.dotDiameter);
    }
    const outFile =
      typeof item === "object" && item !== null && item.output
        ? item.output
        : `label-${i + 1}.stl`;
    const outputPath = path.join(outputDir, path.basename(outFile));
    const name =
      typeof item === "object" && item !== null && item.name
        ? item.name
        : path.basename(outputPath, ".stl");

    const { stl, meta } = buildLabelStl(normalizedText, params, { name });
    await fs.writeFile(outputPath, stl, "utf8");
    console.log(
      `[${i + 1}/${arr.length}] ${outputPath} – ${meta.width.toFixed(1)}×${meta.height.toFixed(1)} mm, ${meta.numLines} line(s), ${meta.totalDots} dots`
    );
  }
  console.log(`Generated ${arr.length} label(s) in ${outputDir}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const defaultParams = getDefaultParams(args);

  if (args.input) {
    const outputDir = args.outputDir || "output";
    await runBatch(args, defaultParams, outputDir);
    return;
  }

  let text = args.text;
  if (text == null || String(text).trim() === "") {
    throw new Error("Missing --text or --input. Use --help for usage.");
  }
  text = normalizeText(text);

  const outputPath = args.output || path.join("output", "braille-label.stl");
  const name = args.name || "braille-label";

  const { stl, meta } = buildLabelStl(text, defaultParams, { name });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, stl, "utf8");

  console.log("Braille label STL generated.");
  console.log(`Output: ${outputPath}`);
  console.log(`Size: ${meta.width.toFixed(1)} x ${meta.height.toFixed(1)} mm, ${meta.numLines} line(s), ${meta.totalDots} dots`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});

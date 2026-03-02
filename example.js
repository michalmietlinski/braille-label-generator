/**
 * Generate example braille label STLs.
 * Run: node example.js
 *
 * Writes to output/:
 *   example-sentence.stl  – full sentence with line break and numbers
 *   example-short.stl      – short single line
 *   example-numbers.stl    – lines with numbers
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLabelStl } from "./src/core/braille.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "output");

const DEFAULT_PARAMS = {
  labelThickness: 2,
  cellHeight: 10,
  padding: 2,
};

const EXAMPLES = [
  {
    name: "example-sentence",
    description: "Full sentence with line break and numbers",
    text: `Room 42 is on floor 3.
Please knock before entering.`,
  },
  {
    name: "example-short",
    description: "Short single line",
    text: "Hello World",
  },
  {
    name: "example-numbers",
    description: "Lines with numbers",
    text: `Test 1 2 32
Count 0 to 9`,
  },
];

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  for (const ex of EXAMPLES) {
    const outputPath = path.join(OUTPUT_DIR, `${ex.name}.stl`);
    const { stl, meta } = buildLabelStl(ex.text, DEFAULT_PARAMS, { name: ex.name });
    await fs.writeFile(outputPath, stl, "utf8");
    console.log(`${ex.name}.stl – ${ex.description}`);
    console.log(`  → ${outputPath}`);
    console.log(`  Size: ${meta.width.toFixed(1)} × ${meta.height.toFixed(1)} mm, ${meta.numLines} line(s), ${meta.totalDots} dots`);
    console.log("");
  }

  console.log("Done. Open the .stl files in output/ to view.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

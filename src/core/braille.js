/**
 * Braille label generator: text → rectangular base + hemisphere dots.
 * Grade 1 Braille: A–Z, a–z (same), space. Numbers: number sign (dots 3456) + A–J for 1–9,0.
 */

import modeling from "@jscad/modeling";
import stlSerializer from "@jscad/stl-serializer";

const { booleans, primitives, transforms } = modeling;
const { subtract, union } = booleans;
const { sphere, cuboid } = primitives;
const { translate } = transforms;
const { serialize } = stlSerializer;

const DEFAULT_SEGMENTS = 32;

// Grade 1 Braille: dot pattern as 6-bit (dot1=0x01 … dot6=0x20)
const LETTER_TO_PATTERN = {
  a: 0x01, b: 0x03, c: 0x09, d: 0x19, e: 0x11, f: 0x0b, g: 0x1b, h: 0x13, i: 0x0a, j: 0x1a,
  k: 0x05, l: 0x07, m: 0x0d, n: 0x1d, o: 0x15, p: 0x0f, q: 0x1f, r: 0x17, s: 0x0e, t: 0x1e,
  u: 0x25, v: 0x27, w: 0x3a, x: 0x2d, y: 0x3d, z: 0x35,
};
// Number sign (dots 3,4,5,6) then A–J for 1–9, 0
const NUMBER_SIGN = 0x3c;
const DIGIT_TO_PATTERN = [0x1a, 0x01, 0x03, 0x09, 0x19, 0x11, 0x0b, 0x1b, 0x13, 0x0a]; // 0,1..9 → J,A..I

/** Returns one or more cell patterns for a character (digits use number sign + digit cell). */
function charToPatterns(ch) {
  if (ch === " " || ch === "\t") return [0];
  const lower = ch.toLowerCase();
  if (LETTER_TO_PATTERN[lower] !== undefined) return [LETTER_TO_PATTERN[lower]];
  const code = ch.codePointAt(0);
  if (code >= 48 && code <= 57) return [NUMBER_SIGN, DIGIT_TO_PATTERN[code - 48]];
  return [0];
}

/**
 * Split text into lines and each line into braille cells.
 * Digits expand to two cells (number sign + digit). Returns { cells: number[][] }.
 */
export function textToBrailleCells(text) {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => [...line].flatMap(charToPatterns));
  const maxCols = lines.length ? Math.max(...lines.map((l) => l.length)) : 0;
  return { lines, maxCols, cells: lines };
}

/**
 * Dot positions in a cell: 2 columns, 3 rows. Indices (col, row) with col in [0,1], row in [0,1,2].
 * Dot numbering: 1= (0,0), 2=(0,1), 3=(0,2), 4=(1,0), 5=(1,1), 6=(1,2).
 * pattern is 6-bit: bit0=dot1, bit1=dot2, ..., bit5=dot6.
 */
function patternToDotPositions(pattern) {
  const positions = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const bitIndex = col * 3 + row; // 0..5
      if (pattern & (1 << bitIndex)) positions.push({ col, row });
    }
  }
  return positions;
}

function toFiniteNumber(value, label) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`${label} must be a finite positive number.`);
  }
  return num;
}

function toNonNegativeNumber(value, label) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return num;
}

/** Standard braille cell: 2 dots wide × 3 dots high → width = height × (2/3) */
const STANDARD_CELL_WIDTH_HEIGHT_RATIO = 2 / 3;

/**
 * Validate and normalize label parameters.
 * - labelThickness: base plate thickness (mm)
 * - cellHeight: height of one braille cell (mm); width is always derived as height × (2/3)
 * - padding: margin around content (mm)
 * - lineSpacing: vertical gap between lines (mm); default 0
 * - dotDiameter: diameter of each raised dot (mm). If not set, derived from cell size
 */
export function validateLabelParams(raw) {
  const labelThickness = toFiniteNumber(raw?.labelThickness ?? 2, "labelThickness");
  const cellHeight = toFiniteNumber(raw?.cellHeight ?? 10, "cellHeight");
  const cellWidth = cellHeight * STANDARD_CELL_WIDTH_HEIGHT_RATIO;
  const padding = toFiniteNumber(raw?.padding ?? 2, "padding");
  const lineSpacing = toNonNegativeNumber(raw?.lineSpacing ?? 0, "lineSpacing");
  const dotDiameterRaw = raw?.dotDiameter;
  let dotDiameter =
    dotDiameterRaw != null && Number.isFinite(Number(dotDiameterRaw)) && Number(dotDiameterRaw) > 0
      ? Number(dotDiameterRaw)
      : Math.min(cellWidth / 2, cellHeight / 3) * 0.8;

  if (dotDiameter >= Math.min(cellWidth / 2, cellHeight / 3)) {
    throw new Error("dotDiameter must be smaller than cell spacing to avoid overlap.");
  }

  return {
    labelThickness,
    cellWidth,
    cellHeight,
    padding,
    lineSpacing,
    dotDiameter,
  };
}

/**
 * Build geometry: flat rectangular base + hemispheres at each dot.
 * Origin: base sits on z=0, top of base at z=labelThickness; dots (hemispheres) on top.
 * X increases right, Y increases up (first line at bottom in Y so that after export Y-up matches “first line at bottom” if needed; we can flip later). Actually for a label we want first line at top: so line 0 at max Y. Let's do: first line at y = padding (bottom of rect in our coords), so that when you look at the label from above, line 0 is at the “top” (max Y). So Y increases upward, first line at top → line 0 at y = totalHeight - padding - cellHeight, line 1 at totalHeight - padding - 2*cellHeight, etc. Simpler: place line 0 at y = padding (so first line is near origin), then line 1 at padding + cellHeight. So “first line” is at smallest Y. For a physical label, “top” is usually the first line; if we want first line at top we use y = totalHeight - padding - (lineIndex+1)*cellHeight. Let me use: base from (0,0,0) to (width, height, labelThickness). Content origin at (padding, padding). Line 0 at y = padding (so first line at bottom in Y). Then when you hold the label with text reading left-to-right, line 0 is at bottom. To have line 0 at top, we’d use y = height - padding - (lineIndex + 1) * cellHeight. I'll do line 0 at top: y0 = height - padding - cellHeight, y1 = height - padding - 2*cellHeight, so y_line = height - padding - (lineIndex + 1) * cellHeight.
 */
export function buildLabelGeometry(text, rawParams, options = {}) {
  const params = validateLabelParams(rawParams);
  const { labelThickness, cellWidth, cellHeight, padding, lineSpacing, dotDiameter } = params;
  const { lines, maxCols, cells } = textToBrailleCells(text);

  const numLines = cells.length;
  const width = maxCols * cellWidth + 2 * padding;
  const height = numLines * cellHeight + (numLines > 1 ? (numLines - 1) * lineSpacing : 0) + 2 * padding;
  const radius = dotDiameter / 2;

  // Base: flat box from (0,0,0) to (width, height, labelThickness)
  const base = cuboid({
    size: [width, height, labelThickness],
    center: [width / 2, height / 2, labelThickness / 2],
  });

  const segments = options.sphereSegments ?? DEFAULT_SEGMENTS;
  // Cut sphere so hemisphere sits flush on base: sphere center on top of base (z = labelThickness),
  // cut at z = labelThickness so we keep only the dome above the base.
  const cutPlaneZ = labelThickness;
  const cutHeight = cutPlaneZ + 1000;
  const halfSpace = cuboid({
    size: [width * 2, height * 2, cutHeight],
    center: [width / 2, height / 2, (cutPlaneZ - 1000) / 2],
  });

  const dotShapes = [];

  for (let lineIndex = 0; lineIndex < cells.length; lineIndex++) {
    const line = cells[lineIndex];
    // First line at top of label: line 0 at max Y; add lineSpacing gap between lines
    const lineY = height - padding - (lineIndex + 0.5) * cellHeight - lineIndex * lineSpacing;

    for (let colIndex = 0; colIndex < line.length; colIndex++) {
      const pattern = line[colIndex];
      const cellX = padding + (colIndex + 0.5) * cellWidth;

      const positions = patternToDotPositions(pattern);
      for (const { col, row } of positions) {
        // Dot center within cell: 2 cols, 3 rows. col 0/1 -> x offset -cellWidth/4, +cellWidth/4; row 0,1,2 top to bottom
        const centerX = cellX + (col - 0.5) * (cellWidth / 2);
        const centerY = lineY + cellHeight / 2 - (row + 0.5) * (cellHeight / 3);

        const sphereCenter = [centerX, centerY, labelThickness];
        const s = sphere({ radius, segments });
        const raised = translate(sphereCenter, s);
        const hemisphere = subtract(raised, halfSpace);
        dotShapes.push(hemisphere);
      }
    }
  }

  const dots = dotShapes.length ? union(...dotShapes) : null;
  const geometry = dots ? union(base, dots) : base;

  return {
    geometry,
    meta: {
      ...params,
      numLines,
      maxCols,
      totalDots: dotShapes.length,
      width,
      height,
    },
  };
}

export function buildLabelStl(text, rawParams, options = {}) {
  const { geometry, meta } = buildLabelGeometry(text, rawParams, options);
  const name = options.name ?? "braille-label";
  const stl = serialize({}, geometry);
  return { stl, meta };
}

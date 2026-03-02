/**
 * Braille label generator (browser). No dependencies.
 * Builds STL from flat rectangular base + hemisphere dots.
 */

// Grade 1 Braille: 6-bit pattern per character (dot1=0x01 … dot6=0x20)
const LETTER_TO_PATTERN = {
  a: 0x01, b: 0x03, c: 0x09, d: 0x19, e: 0x11, f: 0x0b, g: 0x1b, h: 0x13, i: 0x0a, j: 0x1a,
  k: 0x05, l: 0x07, m: 0x0d, n: 0x1d, o: 0x15, p: 0x0f, q: 0x1f, r: 0x17, s: 0x0e, t: 0x1e,
  u: 0x25, v: 0x27, w: 0x3a, x: 0x2d, y: 0x3d, z: 0x35,
};
const NUMBER_SIGN = 0x3c;
const DIGIT_TO_PATTERN = [0x1a, 0x01, 0x03, 0x09, 0x19, 0x11, 0x0b, 0x1b, 0x13, 0x0a]; // 0,1..9 → J,A..I

function charToPatterns(ch) {
  if (ch === " " || ch === "\t") return [0];
  const lower = ch.toLowerCase();
  if (LETTER_TO_PATTERN[lower] !== undefined) return [LETTER_TO_PATTERN[lower]];
  const code = ch.codePointAt(0);
  if (code >= 48 && code <= 57) return [NUMBER_SIGN, DIGIT_TO_PATTERN[code - 48]];
  return [0];
}

function textToBrailleCells(text) {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => [...line].flatMap(charToPatterns));
  const maxCols = lines.length ? Math.max(...lines.map((l) => l.length)) : 0;
  return { lines, maxCols, cells: lines };
}

function patternToDotPositions(pattern) {
  const positions = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const bitIndex = col * 3 + row;
      if (pattern & (1 << bitIndex)) positions.push({ col, row });
    }
  }
  return positions;
}

function setStatus(message, isError = false) {
  const body = document.querySelector("#status .status-body");
  if (!body) return;
  body.textContent = message;
  body.style.color = isError ? "crimson" : "";
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toNum(v, def) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
}

function triNormal(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

function stlFacet(out, a, b, c) {
  const n = triNormal(a, b, c);
  out.push(`  facet normal ${n[0]} ${n[1]} ${n[2]}`);
  out.push("    outer loop");
  out.push(`      vertex ${a[0]} ${a[1]} ${a[2]}`);
  out.push(`      vertex ${b[0]} ${b[1]} ${b[2]}`);
  out.push(`      vertex ${c[0]} ${c[1]} ${c[2]}`);
  out.push("    endloop");
  out.push("  endfacet");
}

// Box from (0,0,0) to (wx, wy, wz). 8 vertices, 12 triangles.
function boxTriangles(wx, wy, wz) {
  const v = (x, y, z) => [x, y, z];
  const verts = [
    v(0, 0, 0), v(wx, 0, 0), v(wx, wy, 0), v(0, wy, 0),
    v(0, 0, wz), v(wx, 0, wz), v(wx, wy, wz), v(0, wy, wz),
  ];
  const tris = [
    [0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6],
    [0, 5, 1], [0, 4, 5], [1, 5, 6], [1, 6, 2],
    [2, 6, 7], [2, 7, 3], [3, 7, 4], [3, 4, 0],
  ];
  return tris.map(([i, j, k]) => [verts[i], verts[j], verts[k]]);
}

// Hemisphere (dome) on top of z=0, center (cx, cy, 0), radius r. Top half of sphere only.
function hemisphereTriangles(cx, cy, r, segments = 16) {
  const segLat = Math.max(4, Math.floor(segments / 2));
  const segLon = Math.max(8, segments);
  const tris = [];
  const verts = [];
  for (let lat = 0; lat <= segLat; lat++) {
    const phi = (Math.PI / 2) * (1 - lat / segLat);
    const y = r * Math.cos(phi);
    const ringR = r * Math.sin(phi);
    for (let lon = 0; lon <= segLon; lon++) {
      const th = (2 * Math.PI * lon) / segLon;
      verts.push([
        cx + ringR * Math.cos(th),
        cy + ringR * Math.sin(th),
        y,
      ]);
    }
  }
  for (let lat = 0; lat < segLat; lat++) {
    for (let lon = 0; lon < segLon; lon++) {
      const i = lat * (segLon + 1) + lon;
      const i1 = i + 1;
      const i2 = i + (segLon + 1);
      const i3 = i2 + 1;
      tris.push([verts[i], verts[i1], verts[i3]]);
      tris.push([verts[i], verts[i3], verts[i2]]);
    }
  }
  return tris;
}

function buildLabelStlBrowser(text, params) {
  const { labelThickness, cellHeight, padding, lineSpacing = 0, dotDiameter: dotD } = params;
  const cellWidth = cellHeight * (2 / 3);
  const dotDiameter = dotD > 0 ? dotD : Math.min(cellWidth / 2, cellHeight / 3) * 0.8;
  const radius = dotDiameter / 2;

  const { cells, maxCols } = textToBrailleCells(text);
  const numLines = cells.length;
  const width = maxCols * cellWidth + 2 * padding;
  const height = numLines * cellHeight + (numLines > 1 ? (numLines - 1) * lineSpacing : 0) + 2 * padding;

  const out = [];
  const name = "braille-label";
  out.push(`solid ${name}`);

  // Base box
  for (const tri of boxTriangles(width, height, labelThickness)) {
    stlFacet(out, tri[0], tri[1], tri[2]);
  }

  // Hemispheres
  const seg = 14;
  for (let lineIndex = 0; lineIndex < cells.length; lineIndex++) {
    const line = cells[lineIndex];
    const lineY = height - padding - (lineIndex + 0.5) * cellHeight - lineIndex * lineSpacing;
    for (let colIndex = 0; colIndex < line.length; colIndex++) {
      const pattern = line[colIndex];
      const cellX = padding + (colIndex + 0.5) * cellWidth;
      for (const { col, row } of patternToDotPositions(pattern)) {
        const centerX = cellX + (col - 0.5) * (cellWidth / 2);
        const centerY = lineY + cellHeight / 2 - (row + 0.5) * (cellHeight / 3);
        const cx = centerX;
        const cy = centerY;
        for (const tri of hemisphereTriangles(cx, cy, radius, seg)) {
          const a = [tri[0][0], tri[0][1], tri[0][2] + labelThickness];
          const b = [tri[1][0], tri[1][1], tri[1][2] + labelThickness];
          const c = [tri[2][0], tri[2][1], tri[2][2] + labelThickness];
          stlFacet(out, a, b, c);
        }
      }
    }
  }

  out.push(`endsolid ${name}`);
  return out.join("\n");
}

function handleSubmit(event) {
  event.preventDefault();
  try {
    let text = document.querySelector("#brailleText").value;
    // Treat literal \n (backslash + n) as line break
    text = text.replace(/\\n/g, "\n");
    if (!text.trim()) {
      throw new Error("Enter some text.");
    }
    const labelThickness = toNum(document.querySelector("#labelThickness").value, 2);
    const cellHeight = toNum(document.querySelector("#cellHeight").value, 10);
    const padding = toNum(document.querySelector("#padding").value, 2);
    const lineSpacing = Math.max(0, toNum(document.querySelector("#lineSpacing").value, 0));
    const dotInput = document.querySelector("#dotDiameter").value;
    const dotDiameter = dotInput === "" ? undefined : toNum(dotInput, undefined);

    const params = {
      labelThickness,
      cellHeight,
      padding,
      lineSpacing,
      dotDiameter: dotDiameter ?? 0,
    };

    const cellWidth = cellHeight * (2 / 3);
    const stl = buildLabelStlBrowser(text, params);
    const { cells, maxCols } = textToBrailleCells(text);
    const numLines = cells.length;
    const totalDots = cells.flatMap((line) => line.flatMap(patternToDotPositions)).length;
    const width = maxCols * cellWidth + 2 * padding;
    const height = numLines * cellHeight + (numLines > 1 ? (numLines - 1) * lineSpacing : 0) + 2 * padding;

    const filename = "braille-label.stl";
    downloadTextFile(filename, stl);

    setStatus(
      [
        `Generated: ${filename}`,
        "",
        `Size: ${width.toFixed(1)} × ${height.toFixed(1)} mm`,
        `Lines: ${numLines}, Dots: ${totalDots}`,
      ].join("\n"),
      false
    );
  } catch (err) {
    setStatus(err.message || String(err), true);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("braille-form");
  if (form) form.addEventListener("submit", handleSubmit);
});

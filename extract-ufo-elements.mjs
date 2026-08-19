/**
 * Extract distinct elements from the UFO abduction sticker image.
 *
 * Elements (top → bottom):
 *   1. UFO flying saucer  (top region)
 *   2. Abduction beam     (middle cone region)
 *   3. Human silhouette   (center, overlaps beam + earth)
 *   4. Earth globe        (bottom circle)
 *   5. Sticker border     (surrounding outline — extracted as composite)
 *
 * Strategy:
 *   - Detect gray background (#D0D0D0 ± tolerance) → mask it out
 *   - Rough bounding-box crops for each element
 *   - Use flood-fill from background corners to remove gray
 */

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const SRC = "C:\\Users\\Administrator\\.dsh\\attachments\\v1\\objects\\84\\848da6e8ffc73e06d17602de71b077628c6205d59cac047dbbeff4cabe7a6193.png";
const OUT = "E:\\vibeCoding\\deepseek-harness\\ufo-elements";

await mkdir(OUT, { recursive: true });

const img = sharp(SRC);
const meta = await img.raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = meta.info;
console.log(`Image: ${width}×${height}, channels=${channels}`);

const raw = meta.data;

// ---- helpers ----
function idx(x, y) {
  return (y * width + x) * channels;
}
function px(x, y) {
  const i = idx(x, y);
  return [raw[i], raw[i + 1], raw[i + 2], channels >= 4 ? raw[i + 3] : 255];
}
function isGray(r, g, b, tol = 40) {
  // Gray background: R≈G≈B in 180-220 range
  return (
    Math.abs(r - g) < tol &&
    Math.abs(g - b) < tol &&
    Math.abs(r - b) < tol &&
    r > 150 &&
    r < 230
  );
}
function isWhite(r, g, b) {
  return r > 230 && g > 230 && b > 230;
}

// ---- Step 1: build a rough mask of non-background pixels ----
const mask = new Uint8Array(width * height);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const [r, g, b] = px(x, y);
    // Mark as foreground if NOT gray background
    mask[y * width + x] = isGray(r, g, b) ? 0 : 1;
  }
}

// ---- Step 2: flood-fill gray from borders to clean interior gray ----
// BFS from all gray border pixels, marking connected gray as background
function floodFillBg() {
  const visited = new Uint8Array(width * height);
  const queue = [];
  // seed from all border pixels
  for (let x = 0; x < width; x++) {
    if (mask[x] === 0) { queue.push(x); visited[x] = 1; }
    const bi = (height - 1) * width + x;
    if (mask[bi] === 0) { queue.push(bi); visited[bi] = 1; }
  }
  for (let y = 0; y < height; y++) {
    const li = y * width;
    const ri = y * width + (width - 1);
    if (mask[li] === 0 && !visited[li]) { queue.push(li); visited[li] = 1; }
    if (mask[ri] === 0 && !visited[ri]) { queue.push(ri); visited[ri] = 1; }
  }
  const dirs = [-1, 1, -width, width];
  let head = 0;
  while (head < queue.length) {
    const ci = queue[head++];
    const cx = ci % width;
    const cy = (ci - cx) / width;
    for (const d of dirs) {
      const ni = ci + d;
      const nx = ni % width;
      const ny = (ni - nx) / width;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (visited[ni]) continue;
      visited[ni] = 1;
      if (mask[ni] === 0) {
        // Connected gray — keep as background
        queue.push(ni);
      }
    }
  }
  // Any gray NOT reached by flood-fill stays as foreground (sticker border)
  // Clear flood-reached gray from mask
  for (const ci of queue) {
    mask[ci] = 0;
  }
}
floodFillBg();

// ---- Step 3: find bounding boxes of each element ----
// Scan rows to find vertical regions
function findRowRanges(mask, width, height) {
  const rows = [];
  let inRegion = false, start = 0;
  for (let y = 0; y < height; y++) {
    let hasFg = false;
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) { hasFg = true; break; }
    }
    if (hasFg && !inRegion) { start = y; inRegion = true; }
    if (!hasFg && inRegion) { rows.push([start, y - 1]); inRegion = false; }
  }
  if (inRegion) rows.push([start, height - 1]);
  return rows;
}

function findColRange(mask, y0, y1, width, height) {
  let xMin = width, xMax = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        if (x < xMin) xMin = x;
        if (x > xMax) xMax = x;
      }
    }
  }
  return [xMin, xMax];
}

const rowRanges = findRowRanges(mask, width, height);
console.log("Row ranges (fg regions):", rowRanges);

// ---- Step 4: segment into 4 main elements ----
// The image is vertically stacked: UFO → beam+human → earth
// We need to find natural breaks

// Merge nearby row ranges (gap < 8px)
function mergeRanges(ranges, gap) {
  if (ranges.length === 0) return [];
  const merged = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const prev = merged[merged.length - 1];
    if (ranges[i][0] - prev[1] <= gap) {
      prev[1] = ranges[i][1];
    } else {
      merged.push([...ranges[i]]);
    }
  }
  return merged;
}

const merged = mergeRanges(rowRanges, 8);
console.log("Merged row ranges:", merged);

// ---- Step 5: extract each region with alpha channel ----
// For each element, crop the bounding box, apply mask, save as PNG with transparency

async function extractElement(name, y0, y1, xPad = 10) {
  const [xMin, xMax] = findColRange(mask, y0, y1, width, height);
  const cropX = Math.max(0, xMin - xPad);
  const cropY = Math.max(0, y0 - xPad);
  const cropW = Math.min(width - cropX, xMax - xMin + xPad * 2);
  const cropH = Math.min(height - cropY, y1 - y0 + xPad * 2);

  // Build RGBA buffer for this crop
  const size = cropW * cropH * 4;
  const buf = Buffer.alloc(size);
  for (let dy = 0; dy < cropH; dy++) {
    for (let dx = 0; dx < cropW; dx++) {
      const sx = cropX + dx;
      const sy = cropY + dy;
      const si = (sy * width + sx) * channels;
      const di = (dy * cropW + dx) * 4;
      buf[di] = raw[si];
      buf[di + 1] = raw[si + 1];
      buf[di + 2] = raw[si + 2];
      buf[di + 3] = mask[sy * width + sx] ? 255 : 0;
    }
  }

  const outPath = join(OUT, `${name}.png`);
  await sharp(buf, { raw: { width: cropW, height: cropH, channels: 4 } })
    .png()
    .toFile(outPath);
  console.log(`  ✓ ${name}: ${cropW}×${cropH} → ${outPath}`);
}

// ---- Step 6: segment and extract ----
// Typical layout (from analysis):
//   UFO saucer:  top ~15%
//   Beam:        middle ~25%
//   Human:       center (overlaps beam)
//   Earth:       bottom ~35%

// Let's use the merged regions to figure out segments
// The image has: sticker border wrapping everything, so merged[0] likely covers all
// Let's do a smarter analysis: look at column density per row

// Find the widest foreground rows (Earth is a circle → widest part in middle)
const rowDensities = [];
for (let y = 0; y < height; y++) {
  let count = 0;
  for (let x = 0; x < width; x++) {
    if (mask[y * width + x]) count++;
  }
  rowDensities.push(count);
}

// Earth is the bottom circle: find where density peaks in bottom half
// Beam is narrow (cone), UFO is medium, Earth is wide

// Use a simple heuristic: scan from bottom up for Earth (wide fg region)
// Earth: continuous fg rows with decent width in bottom half
let earthTop = height;
for (let y = height - 1; y >= 0; y--) {
  const [xMin, xMax] = findColRange(mask, y, y, width, height);
  if (xMax - xMin > width * 0.3) {
    earthTop = y;
  } else {
    break;
  }
}
// Extend earthTop up a bit to capture the full circle
for (let y = earthTop; y >= earthTop - 30; y--) {
  const [xMin, xMax] = findColRange(mask, y, y, width, height);
  if (xMax - xMin > width * 0.2) {
    earthTop = y;
  }
}

// UFO: scan from top down
let ufoBottom = 0;
for (let y = 0; y < height; y++) {
  const [xMin, xMax] = findColRange(mask, y, y, width, height);
  if (xMax - xMin > width * 0.15) {
    ufoBottom = y;
  } else {
    break;
  }
}
// Find where UFO ends (density drops then rises for beam)
let ufoEnd = ufoBottom;
for (let y = ufoBottom + 1; y < earthTop - 20; y++) {
  const density = rowDensities[y];
  if (density < 5) {
    // Gap after UFO
    ufoEnd = y;
    break;
  }
}

// Human silhouette: small, in the middle of beam
// Earth: from earthTop to bottom

const fullY0 = merged[0] ? merged[0][0] : 0;
const fullY1 = merged[merged.length - 1] ? merged[merged.length - 1][1] : height - 1;

console.log(`\nSegmentation:`);
console.log(`  Full range: ${fullY0} → ${fullY1}`);
console.log(`  UFO region: ${fullY0} → ${ufoEnd}`);
console.log(`  Earth region: ${earthTop} → ${fullY1}`);
console.log(`  Beam/human: ${ufoEnd} → ${earthTop}`);

// Extract elements with appropriate padding
await extractElement("1-ufo", fullY0, ufoEnd, 15);
await extractElement("2-beam-human", ufoEnd, earthTop, 10);
await extractElement("4-earth", earthTop, fullY1, 10);

// Also extract the full sticker (everything except gray bg)
await extractElement("0-full-sticker", fullY0, fullY1, 5);

// ---- Extract human silhouette separately (dark region in beam area) ----
// The human is a dark/black silhouette in the beam area
// Build a separate mask for dark pixels (R+G+B < 150) in beam region
const humanMask = new Uint8Array(width * height);
for (let y = ufoEnd; y < earthTop; y++) {
  for (let x = 0; x < width; x++) {
    const [r, g, b, a] = px(x, y);
    const brightness = (r + g + b) / 3;
    if (brightness < 100 && mask[y * width + x]) {
      humanMask[y * width + x] = 1;
    }
  }
}

// Find bounding box of human silhouette
let hMinY = height, hMaxY = 0, hMinX = width, hMaxX = 0;
for (let y = ufoEnd; y < earthTop; y++) {
  for (let x = 0; x < width; x++) {
    if (humanMask[y * width + x]) {
      if (y < hMinY) hMinY = y;
      if (y > hMaxY) hMaxY = y;
      if (x < hMinX) hMinX = x;
      if (x > hMaxX) hMaxX = x;
    }
  }
}

if (hMaxY >= hMinY && hMaxX >= hMinX) {
  const hCropW = hMaxX - hMinX + 1;
  const hCropH = hMaxY - hMinY + 1;
  const hBuf = Buffer.alloc(hCropW * hCropH * 4);
  for (let dy = 0; dy < hCropH; dy++) {
    for (let dx = 0; dx < hCropW; dx++) {
      const sx = hMinX + dx;
      const sy = hMinY + dy;
      const si = (sy * width + sx) * channels;
      const di = (dy * hCropW + dx) * 4;
      hBuf[di] = raw[si];
      hBuf[di + 1] = raw[si + 1];
      hBuf[di + 2] = raw[si + 2];
      hBuf[di + 3] = humanMask[sy * width + sx] ? 255 : 0;
    }
  }
  const outPath = join(OUT, "3-human.png");
  await sharp(hBuf, { raw: { width: hCropW, height: hCropH, channels: 4 } })
    .png()
    .toFile(outPath);
  console.log(`  ✓ 3-human: ${hCropW}×${hCropH} → ${outPath}`);
}

// ---- Also extract UFO with its sticker border removed ----
// UFO region: extract only non-gray pixels (keep sticker border as element)
{
  const [xMin, xMax] = findColRange(mask, fullY0, ufoEnd, width, height);
  const pad = 15;
  const cx0 = Math.max(0, xMin - pad);
  const cy0 = Math.max(0, fullY0 - pad);
  const cw = Math.min(width - cx0, xMax - xMin + pad * 2);
  const ch = Math.min(height - cy0, ufoEnd - fullY0 + pad * 2);

  const buf = Buffer.alloc(cw * ch * 4);
  for (let dy = 0; dy < ch; dy++) {
    for (let dx = 0; dx < cw; dx++) {
      const sx = cx0 + dx;
      const sy = cy0 + dy;
      const si = (sy * width + sx) * channels;
      const di = (dy * cw + dx) * 4;
      buf[di] = raw[si];
      buf[di + 1] = raw[si + 1];
      buf[di + 2] = raw[si + 2];
      buf[di + 3] = mask[sy * width + sx] ? 255 : 0;
    }
  }
  const outPath = join(OUT, "1-ufo.png");
  await sharp(buf, { raw: { width: cw, height: ch, channels: 4 } })
    .png()
    .toFile(outPath);
  console.log(`  ✓ 1-ufo (re-extract): ${cw}×${ch} → ${outPath}`);
}

// ---- Earth with sticker border removed ----
{
  const [xMin, xMax] = findColRange(mask, earthTop, fullY1, width, height);
  const pad = 15;
  const cx0 = Math.max(0, xMin - pad);
  const cy0 = Math.max(0, earthTop - pad);
  const cw = Math.min(width - cx0, xMax - xMin + pad * 2);
  const ch = Math.min(height - cy0, fullY1 - earthTop + pad * 2);

  const buf = Buffer.alloc(cw * ch * 4);
  for (let dy = 0; dy < ch; dy++) {
    for (let dx = 0; dx < cw; dx++) {
      const sx = cx0 + dx;
      const sy = cy0 + dy;
      const si = (sy * width + sx) * channels;
      const di = (dy * cw + dx) * 4;
      buf[di] = raw[si];
      buf[di + 1] = raw[si + 1];
      buf[di + 2] = raw[si + 2];
      buf[di + 3] = mask[sy * width + sx] ? 255 : 0;
    }
  }
  const outPath = join(OUT, "4-earth.png");
  await sharp(buf, { raw: { width: cw, height: ch, channels: 4 } })
    .png()
    .toFile(outPath);
  console.log(`  ✓ 4-earth (re-extract): ${cw}×${ch} → ${outPath}`);
}

console.log(`\n✅ Done! All elements saved to ${OUT}`);

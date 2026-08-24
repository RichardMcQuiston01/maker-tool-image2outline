#!/usr/bin/env node
/**
 * Generates the Stage 4 (PLAN.md) real-image regression corpus.
 *
 * This sandboxed dev environment has no way to source actual camera
 * photos/scans, so this script synthesizes stand-ins: procedurally
 * generated raster images with the same properties a real-image corpus is
 * meant to exercise — gradient/vignette backgrounds, per-pixel noise, and
 * blur — instead of a clean synthetic silhouette on a flat white
 * background (which is what the Stage 1 unit tests already use). Ground
 * truth (exact shape count/hole count/area) is known exactly because each
 * fixture is defined analytically, which the regression harness
 * (test/integration/regression.test.ts) checks the traced output against.
 *
 * Re-run with `node scripts/generate-regression-fixtures.mjs` to
 * regenerate; a fixed PRNG seed per fixture keeps output reproducible.
 *
 * Swapping in real photos later is additive — drop them alongside these
 * with matching manifest entries — not a redesign.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const OUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../test/fixtures/images/regression",
);

/** Deterministic PRNG (mulberry32) so regenerated fixtures are byte-stable. */
function mulberry32(seed) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp255(v) {
  return Math.max(0, Math.min(255, v));
}

/** Builds an RGB buffer via a per-pixel painter callback: (x, y) -> [r, g, b]. */
function paint(width, height, painter) {
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = painter(x, y);
      const p = (y * width + x) * 3;
      data[p] = clamp255(r);
      data[p + 1] = clamp255(g);
      data[p + 2] = clamp255(b);
    }
  }
  return data;
}

function shoelaceArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function pointInPolygon(px, py, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function starPoints(cx, cy, outerR, innerR, spikes) {
  const points = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / spikes) * i - Math.PI / 2;
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return points;
}

const SIZE = 200;
const FOREGROUND = [20, 20, 20];

const fixtures = [];

// 1. Filled circle on a horizontal gradient background with additive noise.
{
  const rand = mulberry32(1);
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const radius = 60;
  const data = paint(SIZE, SIZE, (x, y) => {
    const inside = (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius;
    if (inside) return FOREGROUND;
    const base = 200 + Math.round((x / SIZE) * 50); // gradient: 200 -> 250
    const noise = Math.round((rand() - 0.5) * 24); // +-12
    return [base + noise, base + noise, base + noise];
  });
  fixtures.push({
    name: "circle-gradient-noise",
    data,
    expected: { shapes: 1, holes: 0, area: Math.PI * radius * radius, tolerance: 0.2 },
  });
}

// 2. Filled square on a vignette (edges darker) background with heavier noise.
{
  const rand = mulberry32(2);
  const start = 60;
  const end = 140;
  const side = end - start;
  const data = paint(SIZE, SIZE, (x, y) => {
    const inside = x >= start && x < end && y >= start && y < end;
    if (inside) return FOREGROUND;
    const dx = x - SIZE / 2;
    const dy = y - SIZE / 2;
    const distFromCenter = Math.sqrt(dx * dx + dy * dy) / (SIZE / 2);
    const base = 235 - Math.round(distFromCenter * 60); // vignette
    const noise = Math.round((rand() - 0.5) * 30); // +-15
    return [base + noise, base + noise, base + noise];
  });
  fixtures.push({
    name: "square-vignette-noise",
    data,
    expected: { shapes: 1, holes: 0, area: side * side, tolerance: 0.2 },
  });
}

// 3. Ring (annulus) on a noisy background, to exercise hole detection under noise/blur.
{
  const rand = mulberry32(3);
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const outerR = 70;
  const innerR = 35;
  const data = paint(SIZE, SIZE, (x, y) => {
    const distSq = (x - cx) ** 2 + (y - cy) ** 2;
    const inRing = distSq <= outerR * outerR && distSq >= innerR * innerR;
    if (inRing) return FOREGROUND;
    const base = 245;
    const noise = Math.round((rand() - 0.5) * 20); // +-10
    return [base + noise, base + noise, base + noise];
  });
  fixtures.push({
    name: "ring-noise",
    data,
    blur: 0.6,
    expected: {
      shapes: 1,
      holes: 1,
      area: Math.PI * outerR * outerR,
      holeArea: Math.PI * innerR * innerR,
      tolerance: 0.2,
    },
  });
}

// 4. Five-point star (complex boundary) on a noisy gradient background.
{
  const rand = mulberry32(4);
  const star = starPoints(SIZE / 2, SIZE / 2, 75, 32, 5);
  const area = shoelaceArea(star);
  const data = paint(SIZE, SIZE, (x, y) => {
    if (pointInPolygon(x, y, star)) return FOREGROUND;
    const base = 210 + Math.round((y / SIZE) * 40);
    const noise = Math.round((rand() - 0.5) * 24);
    return [base + noise, base + noise, base + noise];
  });
  fixtures.push({
    name: "star-noise",
    data,
    expected: { shapes: 1, holes: 0, area, tolerance: 0.25 },
  });
}

await mkdir(OUT_DIR, { recursive: true });

const manifest = {};
for (const fixture of fixtures) {
  let image = sharp(fixture.data, { raw: { width: SIZE, height: SIZE, channels: 3 } });
  if (fixture.blur) image = image.blur(fixture.blur);
  const filename = `${fixture.name}.png`;
  await image.png().toFile(path.join(OUT_DIR, filename));
  manifest[filename] = { width: SIZE, height: SIZE, ...fixture.expected };
  console.log(`wrote ${filename}`);
}

await writeFile(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("wrote manifest.json");

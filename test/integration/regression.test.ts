/**
 * Real-image regression harness (PLAN.md Stage 4). Runs every fixture in
 * `test/fixtures/images/regression/` (see
 * `scripts/generate-regression-fixtures.mjs` for how — and why — they're
 * synthesized rather than real camera photos) through the vision pipeline
 * and checks the traced output against each fixture's known ground truth
 * (`manifest.json`): shape/hole count, and outer/hole area within a
 * generous tolerance (noise, blur, and simplification all perturb the
 * traced boundary from the analytic shape, so this is a regression check,
 * not a pixel-exact one).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { nodeImageDecodeAdapter } from "../../src/adapters/node.js";
import type { VectorPath } from "../../src/ir/types.js";
import { traceImage } from "../../src/vision/pipeline.js";

const FIXTURES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/images/regression",
);

interface ManifestEntry {
  readonly width: number;
  readonly height: number;
  readonly shapes: number;
  readonly holes: number;
  readonly area: number;
  readonly holeArea?: number;
  readonly tolerance: number;
}

/** Shoelace formula over a path's vertices (every segment here is a `line`). */
function pathArea(path: VectorPath): number {
  const points = [path.start, ...path.segments.map((s) => s.to)];
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function expectWithinTolerance(
  actual: number,
  expected: number,
  tolerance: number,
  label: string,
): void {
  const margin = expected * tolerance;
  expect(actual, label).toBeGreaterThan(expected - margin);
  expect(actual, label).toBeLessThan(expected + margin);
}

async function loadManifest(): Promise<Record<string, ManifestEntry>> {
  const raw = await readFile(path.join(FIXTURES_DIR, "manifest.json"), "utf8");
  return JSON.parse(raw) as Record<string, ManifestEntry>;
}

describe("real-image regression corpus", () => {
  it("traces every fixture within tolerance of its known ground truth", async () => {
    const manifest = await loadManifest();
    const filenames = Object.keys(manifest);
    expect(filenames.length).toBeGreaterThan(0);

    for (const filename of filenames) {
      const expected = manifest[filename]!;
      const png = await readFile(path.join(FIXTURES_DIR, filename));
      const decoded = await nodeImageDecodeAdapter.decode(png);
      const doc = traceImage(decoded);

      expect(doc.width, `${filename}: width`).toBe(expected.width);
      expect(doc.height, `${filename}: height`).toBe(expected.height);
      expect(doc.shapes, `${filename}: shape count`).toHaveLength(expected.shapes);

      const shape = doc.shapes[0]!;
      expect(shape.holes, `${filename}: hole count`).toHaveLength(expected.holes);

      expectWithinTolerance(
        pathArea(shape.outer.path),
        expected.area,
        expected.tolerance,
        `${filename}: outer area`,
      );

      if (expected.holeArea !== undefined) {
        expectWithinTolerance(
          pathArea(shape.holes[0]!.path),
          expected.holeArea,
          expected.tolerance,
          `${filename}: hole area`,
        );
      }
    }
  });
});

/**
 * Performance smoke test (PLAN.md Stage 4, "performance pass on large
 * images"). Not a benchmark — a regression guard with a generous budget,
 * so it stays reliable on slower CI runners while still catching a
 * pipeline change that makes large images pathologically slow.
 *
 * Measured baseline on a representative 2000x2000px (4MP) single-shape
 * image, decode through both writers: ~2s (see CHANGELOG for the M4
 * entry). The budget below is 5x that, as headroom.
 */

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { image2outline } from "../../src/index.js";

const SIZE = 2000;
const BUDGET_MS = 10_000;

/** A filled circle on a plain white background, at `SIZE`px. */
async function synthesizeLargeCirclePng(): Promise<Buffer> {
  const channels = 3;
  const data = Buffer.alloc(SIZE * SIZE * channels, 255);
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const radius = SIZE * 0.35;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radius * radius) {
        const p = (y * SIZE + x) * channels;
        data[p] = 0;
        data[p + 1] = 0;
        data[p + 2] = 0;
      }
    }
  }
  return sharp(data, { raw: { width: SIZE, height: SIZE, channels } })
    .png()
    .toBuffer();
}

describe("performance", () => {
  it(
    `traces a ${SIZE}x${SIZE}px image and writes both formats within ${BUDGET_MS}ms`,
    async () => {
      const png = await synthesizeLargeCirclePng();

      const start = performance.now();
      const result = await image2outline(png, { formats: ["svg", "dxf"] });
      const elapsed = performance.now() - start;

      expect(result.outputs).toHaveLength(2);
      expect(elapsed).toBeLessThan(BUDGET_MS);
    },
    BUDGET_MS + 5_000,
  );
});

import { describe, expect, it } from "vitest";

import type { DecodedImage } from "../../src/adapters/types.js";
import { traceImage } from "../../src/vision/pipeline.js";

/** Builds a DecodedImage by mapping each row of `rows` (0 = white, 1 = black) to RGBA pixels. */
function buildImage(rows: readonly (readonly (0 | 1)[])[]): DecodedImage {
  const height = rows.length;
  const width = rows[0]!.length;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = rows[y]![x]! === 1 ? 0 : 255;
      const p = (y * width + x) * 4;
      data[p] = value;
      data[p + 1] = value;
      data[p + 2] = value;
      data[p + 3] = 255;
    }
  }
  return { width, height, data };
}

describe("traceImage", () => {
  it("produces one shape with no holes for a filled square (Stage 1 exit criteria)", () => {
    const rows: (0 | 1)[][] = Array.from({ length: 10 }, () => Array(10).fill(0));
    for (let y = 3; y <= 6; y++) {
      for (let x = 3; x <= 6; x++) rows[y]![x] = 1;
    }
    const doc = traceImage(buildImage(rows), { blurRadius: 0, simplifyEpsilon: 0.5 });

    expect(doc.unit).toBe("px");
    expect(doc.width).toBe(10);
    expect(doc.height).toBe(10);
    expect(doc.shapes).toHaveLength(1);
    expect(doc.shapes[0]!.holes).toHaveLength(0);
    expect(doc.shapes[0]!.outer.isHole).toBe(false);
    expect(doc.shapes[0]!.outer.path.closed).toBe(true);
    // A 4x4 square simplifies to its 4 corners: a starting point plus 3
    // line segments (the 4th edge is implied by `closed: true`).
    expect(doc.shapes[0]!.outer.path.segments).toHaveLength(3);
  });

  it("keeps the inner ring for a traced 'O' shape (nested-hole support)", () => {
    const rows: (0 | 1)[][] = Array.from({ length: 9 }, () => Array(9).fill(0));
    for (let y = 1; y <= 7; y++) {
      for (let x = 1; x <= 7; x++) rows[y]![x] = 1;
    }
    for (let y = 3; y <= 5; y++) {
      for (let x = 3; x <= 5; x++) rows[y]![x] = 0;
    }
    const doc = traceImage(buildImage(rows), { blurRadius: 0, simplifyEpsilon: 0.5 });

    expect(doc.shapes).toHaveLength(1);
    const [shape] = doc.shapes;
    expect(shape!.holes).toHaveLength(1);
    // isHole (the discriminant), not winding direction, is what
    // distinguishes a hole from an outer contour in this IR — Moore-neighbor
    // tracing reports the same rotational handedness for any traced blob
    // regardless of whether it's an outer shape or a hole.
    expect(shape!.holes[0]!.isHole).toBe(true);
    expect(["clockwise", "counterclockwise"]).toContain(shape!.holes[0]!.winding);
  });

  it("supports multiple disjoint objects in one image", () => {
    const rows: (0 | 1)[][] = Array.from({ length: 8 }, () => Array(12).fill(0));
    for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) rows[y]![x] = 1;
    for (let y = 4; y <= 6; y++) for (let x = 8; x <= 10; x++) rows[y]![x] = 1;

    const doc = traceImage(buildImage(rows), { blurRadius: 0 });
    expect(doc.shapes).toHaveLength(2);
    expect(new Set(doc.shapes.map((s) => s.id)).size).toBe(2);
  });
});

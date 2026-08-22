import { describe, expect, it } from "vitest";

import { labelComponents } from "../../src/vision/components.js";
import { polygonWinding, traceBoundary, traceComponent } from "../../src/vision/trace.js";
import { simplifyClosedPath } from "../../src/vision/simplify.js";
import type { BinaryMask, PixelPoint } from "../../src/vision/types.js";

function buildMask(rows: readonly (readonly (0 | 1)[])[]): BinaryMask {
  const height = rows.length;
  const width = rows[0]!.length;
  return { width, height, data: Uint8Array.from(rows.flat()) };
}

function asPointSet(points: readonly PixelPoint[]): Set<string> {
  return new Set(points.map((p) => `${p.x},${p.y}`));
}

describe("traceBoundary", () => {
  it("returns a single point for an isolated pixel", () => {
    const inside = (x: number, y: number): boolean => x === 0 && y === 0;
    expect(traceBoundary(inside, { x: 0, y: 0 })).toEqual([{ x: 0, y: 0 }]);
  });

  it("traces exactly the perimeter pixels of a solid 3x3 square", () => {
    const inside = (x: number, y: number): boolean => x >= 0 && x <= 2 && y >= 0 && y <= 2;
    const boundary = traceBoundary(inside, { x: 0, y: 0 });

    const expectedPerimeter = new Set(["0,0", "1,0", "2,0", "0,1", "2,1", "0,2", "1,2", "2,2"]);
    expect(asPointSet(boundary)).toEqual(expectedPerimeter);
    // No duplicate visits (aside from the implicit close back to the start).
    expect(boundary.length).toBe(expectedPerimeter.size);
  });

  it("does not dip into a single-pixel hole when tracing the outer boundary", () => {
    const mask = buildMask([
      [1, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
    ]);
    const inside = (x: number, y: number): boolean =>
      x >= 0 && x < mask.width && y >= 0 && y < mask.height && mask.data[y * mask.width + x] === 1;
    const boundary = traceBoundary(inside, { x: 0, y: 0 });
    expect(asPointSet(boundary)).not.toContain("1,1");
    expect(boundary.length).toBe(8); // the full ring, no repeats
  });
});

describe("polygonWinding", () => {
  it("assigns a consistent, non-degenerate winding to a traced square", () => {
    const inside = (x: number, y: number): boolean => x >= 0 && x <= 2 && y >= 0 && y <= 2;
    const boundary = traceBoundary(inside, { x: 0, y: 0 });
    const winding = polygonWinding(boundary);
    expect(["clockwise", "counterclockwise"]).toContain(winding);

    // Pin the actual sign so a future refactor can't silently flip it.
    const square = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ];
    expect(polygonWinding(square)).toBe("counterclockwise");
    expect(polygonWinding([...square].reverse())).toBe("clockwise");
  });
});

describe("traceComponent", () => {
  it("finds no holes in a solid blob", () => {
    const mask = buildMask([
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ]);
    const [component] = labelComponents(mask);
    const traced = traceComponent(mask.width, mask.height, component!);
    expect(traced.holes).toHaveLength(0);
    expect(simplifyClosedPath(traced.outer, 0.5).length).toBe(4);
  });

  it("finds one hole in a ring (the 'O' case)", () => {
    const mask = buildMask([
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ]);
    const [component] = labelComponents(mask);
    const traced = traceComponent(mask.width, mask.height, component!);

    expect(traced.holes).toHaveLength(1);
    // Hole boundary should be the inner ring: all 3x3-minus-center-adjacent
    // pixels immediately surrounding the empty interior.
    expect(asPointSet(traced.holes[0]!)).toEqual(
      new Set(["1,1", "2,1", "3,1", "1,2", "3,2", "1,3", "2,3", "3,3"]),
    );
    // Outer boundary stays on the true exterior, ignoring the inner ring.
    expect(asPointSet(traced.outer)).toEqual(
      new Set([
        "0,0",
        "1,0",
        "2,0",
        "3,0",
        "4,0",
        "0,1",
        "4,1",
        "0,2",
        "4,2",
        "0,3",
        "4,3",
        "0,4",
        "1,4",
        "2,4",
        "3,4",
        "4,4",
      ]),
    );
  });

  it("finds two separate holes in a shape with two disjoint enclosed regions", () => {
    const mask = buildMask([
      [1, 1, 1, 1, 1, 1, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 1, 1, 1, 1, 1, 1],
    ]);
    const [component] = labelComponents(mask);
    const traced = traceComponent(mask.width, mask.height, component!);
    expect(traced.holes).toHaveLength(2);
  });
});

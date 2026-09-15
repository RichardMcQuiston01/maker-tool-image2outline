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

  it("throws rather than silently returning a partial boundary if the trace can't close", () => {
    // An `inside` predicate whose answer for (1,0) flips after the first
    // query — simulating a caller bug where membership isn't stable across
    // calls. The tracer must fail loudly instead of returning a truncated
    // boundary that downstream code would treat as a valid closed contour.
    let queriedOnce = false;
    const inside = (x: number, y: number): boolean => {
      if (x === 0 && y === 0) return true;
      if (x === 1 && y === 0) {
        const answer = !queriedOnce;
        queriedOnce = true;
        return answer;
      }
      return false;
    };
    expect(() => traceBoundary(inside, { x: 0, y: 0 })).toThrow(/did not close/);
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

  /**
   * Builds a solid `size`x`size` square with a single-pixel hole punched at
   * (1,1) — standing in for the tiny dark specks a printed logo/text/icon
   * leaves in an otherwise solid photographed object once binarized. Area
   * ratio shrinks as `size` grows, letting tests target either side of the
   * default 3% threshold.
   */
  function buildSolidSquareWithPinholeAt(size: number): BinaryMask {
    const rows: (0 | 1)[][] = Array.from({ length: size }, () => Array(size).fill(1));
    rows[1]![1] = 0;
    return buildMask(rows);
  }

  it("drops a hole well below the default area-ratio threshold (printed-logo noise)", () => {
    // 20x20 solid square minus a 1-pixel hole: ratio = 1 / 399 ≈ 0.25%,
    // comfortably under the default 3% — modeled on a real photographed
    // tool whose printed logo/text produced holes up to ~1.7% of the
    // silhouette's area.
    const mask = buildSolidSquareWithPinholeAt(20);
    const [component] = labelComponents(mask);
    const traced = traceComponent(mask.width, mask.height, component!);
    expect(traced.holes).toHaveLength(0);
  });

  it("keeps a hole at or above the default area-ratio threshold", () => {
    // Reuses the existing "two disjoint holes" mask, where each 1-pixel
    // hole is ~5.26% of the 19-pixel component — above the 3% default.
    const mask = buildMask([
      [1, 1, 1, 1, 1, 1, 1],
      [1, 0, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1, 1],
    ]);
    const [component] = labelComponents(mask);
    const traced = traceComponent(mask.width, mask.height, component!);
    expect(traced.holes).toHaveLength(1);
  });

  it("keeps every hole regardless of size when minHoleAreaRatio is 0", () => {
    const mask = buildSolidSquareWithPinholeAt(20);
    const [component] = labelComponents(mask);
    const traced = traceComponent(mask.width, mask.height, component!, 0);
    expect(traced.holes).toHaveLength(1);
  });

  it("respects an explicit minHoleAreaRatio override", () => {
    // The ring's hole is ~56% of its own component's area — set the
    // threshold above that to confirm even a large legitimate hole can be
    // dropped when a caller explicitly asks for it.
    const mask = buildMask([
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ]);
    const [component] = labelComponents(mask);
    const traced = traceComponent(mask.width, mask.height, component!, 0.9);
    expect(traced.holes).toHaveLength(0);
  });
});

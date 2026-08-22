import { describe, expect, it } from "vitest";

import { simplifyClosedPath, simplifyPath } from "../../src/vision/simplify.js";

describe("simplifyPath", () => {
  it("collapses collinear interior points", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];
    expect(simplifyPath(points, 0.5)).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  it("keeps a point that deviates beyond epsilon", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 5, y: 10 }, // far off the x-axis
      { x: 10, y: 0 },
    ];
    expect(simplifyPath(points, 1)).toEqual(points);
  });

  it("is a no-op for fewer than 3 points or epsilon <= 0", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    expect(simplifyPath(points, 5)).toEqual(points);
    expect(
      simplifyPath(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 2, y: 2 },
        ],
        0,
      ),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ]);
  });
});

describe("simplifyClosedPath", () => {
  it("collapses a pixel-traced square down to its 4 corners", () => {
    // Dense boundary trace of a 3x3 square: all 8 perimeter pixels in order.
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 1 },
    ];
    const simplified = simplifyClosedPath(points, 0.5);
    expect(new Set(simplified.map((p) => `${p.x},${p.y}`))).toEqual(
      new Set(["0,0", "2,0", "2,2", "0,2"]),
    );
  });

  it("leaves short paths untouched", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    expect(simplifyClosedPath(points, 1)).toEqual(points);
  });
});

import { describe, expect, it } from "vitest";

import { findConnectedRegions, labelComponents } from "../../src/vision/components.js";
import type { BinaryMask } from "../../src/vision/types.js";

function buildMask(rows: readonly (readonly (0 | 1)[])[]): BinaryMask {
  const height = rows.length;
  const width = rows[0]!.length;
  return { width, height, data: Uint8Array.from(rows.flat()) };
}

describe("findConnectedRegions", () => {
  it("returns nothing for an all-zero field", () => {
    const regions = findConnectedRegions(3, 3, () => false, 8);
    expect(regions).toHaveLength(0);
  });

  it("finds a single region covering every member cell", () => {
    const regions = findConnectedRegions(2, 2, () => true, 4);
    expect(regions).toHaveLength(1);
    expect(regions[0]!.cells.size).toBe(4);
    expect(regions[0]!.startPoint).toEqual({ x: 0, y: 0 });
    expect(regions[0]!.bbox).toEqual({ minX: 0, minY: 0, maxX: 1, maxY: 1 });
  });

  it("treats diagonal-only touching cells as connected under 8-connectivity but not 4", () => {
    // . 1
    // 1 .
    const isMember = (i: number): boolean => i === 1 || i === 2; // width=2: (1,0) and (0,1)
    expect(findConnectedRegions(2, 2, isMember, 8)).toHaveLength(1);
    expect(findConnectedRegions(2, 2, isMember, 4)).toHaveLength(2);
  });
});

describe("labelComponents", () => {
  it("finds one component per disjoint blob (multi-object support)", () => {
    const mask = buildMask([
      [1, 1, 0, 0, 1],
      [1, 1, 0, 0, 1],
      [0, 0, 0, 0, 0],
    ]);
    const components = labelComponents(mask);
    expect(components).toHaveLength(2);
    expect(components[0]!.startPoint).toEqual({ x: 0, y: 0 });
    expect(components[0]!.cells.size).toBe(4);
    expect(components[1]!.startPoint).toEqual({ x: 4, y: 0 });
    expect(components[1]!.cells.size).toBe(2);
  });

  it("keeps a foreground ring with a hole as one component", () => {
    const mask = buildMask([
      [1, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
    ]);
    const components = labelComponents(mask);
    expect(components).toHaveLength(1);
    expect(components[0]!.cells.size).toBe(8);
  });
});

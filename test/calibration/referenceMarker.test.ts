import { describe, expect, it } from "vitest";

import { detectReferenceMarker, excludeShape } from "../../src/calibration/referenceMarker.js";
import {
  curvedDocument,
  pentagonDocument,
  rotatedSquareMarkerWithObjectDocument,
  squareMarkerWithObjectDocument,
  twoSquareMarkersDocument,
} from "../fixtures/ir/index.js";

describe("detectReferenceMarker", () => {
  it("finds an axis-aligned square marker and derives pixelsPerUnit from its side length", () => {
    const result = detectReferenceMarker(squareMarkerWithObjectDocument, { size: 10, unit: "mm" });
    expect(result.shapeId).toBe("marker");
    expect(result.scale.unit).toBe("mm");
    expect(result.scale.pixelsPerUnit).toBeCloseTo(2, 6); // 20px side / 10mm
  });

  it("finds a marker rotated 45 degrees, using its own edge/diagonal geometry", () => {
    const result = detectReferenceMarker(rotatedSquareMarkerWithObjectDocument, {
      size: 5,
      unit: "mm",
    });
    expect(result.shapeId).toBe("marker");
    expect(result.scale.pixelsPerUnit).toBeCloseTo(Math.sqrt(200) / 5, 6);
  });

  it("throws when no shape matches a square marker", () => {
    expect(() => detectReferenceMarker(pentagonDocument, { size: 10, unit: "mm" })).toThrow(
      /no reference marker found/i,
    );
  });

  it("throws when more than one shape matches (ambiguous)", () => {
    expect(() => detectReferenceMarker(twoSquareMarkersDocument, { size: 10, unit: "mm" })).toThrow(
      /multiple shapes match/i,
    );
  });

  it("ignores shapes with cubic segments (not simple polygons)", () => {
    const doc = {
      ...curvedDocument,
      shapes: [...curvedDocument.shapes, squareMarkerWithObjectDocument.shapes[0]!],
    };
    const result = detectReferenceMarker(doc, { size: 10, unit: "mm" });
    expect(result.shapeId).toBe("marker");
  });

  it.each([0, -5, NaN, Infinity])("rejects a non-positive or non-finite size (%s)", (size) => {
    expect(() =>
      detectReferenceMarker(squareMarkerWithObjectDocument, { size, unit: "mm" }),
    ).toThrow(RangeError);
  });

  it("accepts a near-square within the default tolerance", () => {
    // Sides 20, 20, 22, 20 (10% deviation on one side) — within the 15% default.
    const doc = {
      unit: "px" as const,
      width: 100,
      height: 100,
      shapes: [
        {
          id: "marker",
          outer: {
            isHole: false as const,
            winding: "clockwise" as const,
            path: {
              start: { x: 0, y: 0 },
              closed: true,
              segments: [
                { type: "line" as const, to: { x: 20, y: 0 } },
                { type: "line" as const, to: { x: 22, y: 20 } },
                { type: "line" as const, to: { x: 2, y: 20 } },
              ],
            },
          },
          holes: [],
        },
      ],
    };
    expect(() => detectReferenceMarker(doc, { size: 10, unit: "mm" })).not.toThrow();
  });

  it("rejects a rectangle whose sides deviate beyond tolerance", () => {
    const doc = {
      unit: "px" as const,
      width: 100,
      height: 100,
      shapes: [
        {
          id: "rect",
          outer: {
            isHole: false as const,
            winding: "clockwise" as const,
            path: {
              start: { x: 0, y: 0 },
              closed: true,
              segments: [
                { type: "line" as const, to: { x: 40, y: 0 } },
                { type: "line" as const, to: { x: 40, y: 20 } },
                { type: "line" as const, to: { x: 0, y: 20 } },
              ],
            },
          },
          holes: [],
        },
      ],
    };
    expect(() => detectReferenceMarker(doc, { size: 10, unit: "mm" })).toThrow(
      /no reference marker found/i,
    );
  });
});

describe("excludeShape", () => {
  it("removes the shape with the given id and preserves the rest", () => {
    const result = excludeShape(squareMarkerWithObjectDocument, "marker");
    expect(result.shapes).toHaveLength(1);
    expect(result.shapes[0]!.id).toBe("object");
  });

  it("does not mutate the input document", () => {
    const original = JSON.parse(JSON.stringify(squareMarkerWithObjectDocument));
    excludeShape(squareMarkerWithObjectDocument, "marker");
    expect(squareMarkerWithObjectDocument).toEqual(original);
  });
});

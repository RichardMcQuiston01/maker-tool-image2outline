import { describe, expect, it } from "vitest";

import { calibrate } from "../../src/calibration/calibrate.js";
import {
  curvedDocument,
  pixelSquareDocument,
  squareWithHoleDocument,
} from "../fixtures/ir/index.js";

describe("calibrate", () => {
  it("passes the document through unchanged (same reference) when no options are given", () => {
    expect(calibrate(pixelSquareDocument)).toBe(pixelSquareDocument);
  });

  it("passes the document through unchanged when flipY is explicitly false and no scale is given", () => {
    expect(calibrate(pixelSquareDocument, { flipY: false })).toBe(pixelSquareDocument);
  });

  it("converts pixel coordinates to real-world units via manual scale", () => {
    const result = calibrate(pixelSquareDocument, { scale: { pixelsPerUnit: 10, unit: "mm" } });

    expect(result.unit).toBe("mm");
    expect(result.width).toBe(10);
    expect(result.height).toBe(10);

    const outer = result.shapes[0]!.outer;
    expect(outer.path.start).toEqual({ x: 0, y: 0 });
    expect(outer.path.segments).toEqual([
      { type: "line", to: { x: 10, y: 0 } },
      { type: "line", to: { x: 10, y: 10 } },
      { type: "line", to: { x: 0, y: 10 } },
    ]);
  });

  it("flips Y and moves the origin to the bottom-left when flipY is true", () => {
    const result = calibrate(pixelSquareDocument, { flipY: true });

    expect(result.unit).toBe("px");
    expect(result.width).toBe(100);
    expect(result.height).toBe(100);

    const outer = result.shapes[0]!.outer;
    expect(outer.path.start).toEqual({ x: 0, y: 100 });
    expect(outer.path.segments).toEqual([
      { type: "line", to: { x: 100, y: 100 } },
      { type: "line", to: { x: 100, y: 0 } },
      { type: "line", to: { x: 0, y: 0 } },
    ]);
  });

  it("flips a contour's winding when flipY is true, since reflection inverts orientation", () => {
    const result = calibrate(pixelSquareDocument, { flipY: true });
    expect(pixelSquareDocument.shapes[0]!.outer.winding).toBe("clockwise");
    expect(result.shapes[0]!.outer.winding).toBe("counterclockwise");
  });

  it("does not flip winding when flipY is false", () => {
    const result = calibrate(pixelSquareDocument, { scale: { pixelsPerUnit: 10, unit: "mm" } });
    expect(result.shapes[0]!.outer.winding).toBe("clockwise");
  });

  it("combines scale conversion and Y-flip", () => {
    const result = calibrate(pixelSquareDocument, {
      scale: { pixelsPerUnit: 10, unit: "mm" },
      flipY: true,
    });

    expect(result.unit).toBe("mm");
    expect(result.width).toBe(10);
    expect(result.height).toBe(10);

    const outer = result.shapes[0]!.outer;
    expect(outer.path.start).toEqual({ x: 0, y: 10 });
    expect(outer.path.segments).toEqual([
      { type: "line", to: { x: 10, y: 10 } },
      { type: "line", to: { x: 10, y: 0 } },
      { type: "line", to: { x: 0, y: 0 } },
    ]);
  });

  it("preserves shape ids and hole structure, and flips hole winding under flipY", () => {
    const result = calibrate(squareWithHoleDocument, { flipY: true });

    expect(result.shapes).toHaveLength(1);
    const shape = result.shapes[0]!;
    expect(shape.id).toBe("ring");
    expect(shape.holes).toHaveLength(1);

    const hole = shape.holes[0]!;
    expect(squareWithHoleDocument.shapes[0]!.holes[0]!.winding).toBe("counterclockwise");
    expect(hole.winding).toBe("clockwise");
  });

  it("transforms cubic segment control points along with line segments", () => {
    const result = calibrate(curvedDocument, { scale: { pixelsPerUnit: 2, unit: "mm" } });

    const segment = result.shapes[0]!.outer.path.segments[0]!;
    expect(segment).toEqual({
      type: "cubic",
      control1: { x: 0, y: 5 },
      control2: { x: 5, y: 5 },
      to: { x: 5, y: 0 },
    });
  });

  it("does not mutate the input document", () => {
    const original = JSON.parse(JSON.stringify(pixelSquareDocument));
    calibrate(pixelSquareDocument, { scale: { pixelsPerUnit: 10, unit: "mm" }, flipY: true });
    expect(pixelSquareDocument).toEqual(original);
  });
});

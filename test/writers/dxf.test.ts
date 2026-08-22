import { describe, expect, it } from "vitest";

import {
  curvedDocument,
  squareDocument,
  squareWithHoleDocument,
  twoSquaresDocument,
} from "../fixtures/ir/index.js";
import { writeDxf } from "../../src/writers/dxf.js";
import { parseEntities, parseLwpolyline } from "./dxfParser.js";

function pairs(dxf: string): { code: number; value: string }[] {
  const lines = dxf.trim().split("\n");
  const result: { code: number; value: string }[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    result.push({ code: Number(lines[i]), value: lines[i + 1]! });
  }
  return result;
}

describe("writeDxf", () => {
  it("emits the expected HEADER section for a known unit (golden file)", () => {
    const dxf = writeDxf(squareDocument); // unit: "mm"
    const header = pairs(dxf).slice(0, 6);
    expect(header).toEqual([
      { code: 0, value: "SECTION" },
      { code: 2, value: "HEADER" },
      { code: 9, value: "$ACADVER" },
      { code: 1, value: "AC1015" },
      { code: 9, value: "$INSUNITS" },
      { code: 70, value: "4" }, // mm
    ]);
  });

  it("maps each Unit to the correct $INSUNITS code", () => {
    const insunits = (dxf: string): string => pairs(dxf).find((p) => p.code === 70)!.value;
    expect(insunits(writeDxf({ ...squareDocument, unit: "px" }))).toBe("0");
    expect(insunits(writeDxf({ ...squareDocument, unit: "in" }))).toBe("1");
    expect(insunits(writeDxf({ ...squareDocument, unit: "mm" }))).toBe("4");
  });

  it("ends with EOF", () => {
    const dxf = writeDxf(squareDocument);
    const all = pairs(dxf);
    expect(all[all.length - 1]).toEqual({ code: 0, value: "EOF" });
  });

  it("round-trips a square's geometry as one closed LWPOLYLINE", () => {
    const dxf = writeDxf(squareDocument, { layer: "CUT" });
    const entities = parseEntities(dxf);
    expect(entities).toHaveLength(1);

    const poly = parseLwpolyline(entities[0]!);
    expect(poly.layer).toBe("CUT");
    expect(poly.closed).toBe(true);
    expect(poly.vertexCount).toBe(4);
    expect(poly.points).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
  });

  it("round-trips outer + hole as two separate closed LWPOLYLINEs", () => {
    const dxf = writeDxf(squareWithHoleDocument);
    const entities = parseEntities(dxf);
    expect(entities).toHaveLength(2);

    const [outer, hole] = entities.map(parseLwpolyline);
    expect(outer!.points).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]);
    expect(hole!.points).toEqual([
      { x: 4, y: 4 },
      { x: 6, y: 4 },
      { x: 6, y: 6 },
      { x: 4, y: 6 },
    ]);
    expect(outer!.closed && hole!.closed).toBe(true);
  });

  it("emits one LWPOLYLINE per contour across multiple shapes", () => {
    const dxf = writeDxf(twoSquaresDocument);
    expect(parseEntities(dxf)).toHaveLength(2);
  });

  it("flattens a cubic segment to the requested number of straight vertices", () => {
    const dxf = writeDxf(curvedDocument, { bezierSegments: 4 });
    const [entity] = parseEntities(dxf);
    const poly = parseLwpolyline(entity!);

    // start point + 4 sampled points along the single cubic segment.
    expect(poly.vertexCount).toBe(5);
    expect(poly.points[0]).toEqual({ x: 0, y: 0 });
    // The curve's final sample must land exactly on the segment's `to` point.
    const last = poly.points[poly.points.length - 1]!;
    const expectedTo = curvedDocument.shapes[0]!.outer.path.segments[0]!;
    if (expectedTo.type === "cubic") {
      expect(last.x).toBeCloseTo(expectedTo.to.x, 6);
      expect(last.y).toBeCloseTo(expectedTo.to.y, 6);
    }
  });

  it("includes only the default layer when the custom layer name is '0'", () => {
    const dxf = writeDxf(squareDocument, { layer: "0" });
    const all = pairs(dxf);
    const tableCountIndex = all.findIndex((p) => p.code === 2 && p.value === "LAYER");
    // group 70 immediately after "LAYER" is the layer-table's entry count.
    expect(all[tableCountIndex + 1]).toEqual({ code: 70, value: "1" });
  });
});

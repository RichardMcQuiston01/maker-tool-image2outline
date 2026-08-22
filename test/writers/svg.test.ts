import { describe, expect, it } from "vitest";

import {
  curvedDocument,
  squareDocument,
  squareWithHoleDocument,
  twoSquaresDocument,
} from "../fixtures/ir/index.js";
import { writeSvg } from "../../src/writers/svg.js";
import { parsePathD } from "./svgPathParser.js";

function extractPaths(svg: string): { id: string; d: string }[] {
  return [...svg.matchAll(/<path id="([^"]*)" d="([^"]*)"/g)].map((m) => ({ id: m[1]!, d: m[2]! }));
}

describe("writeSvg", () => {
  it("renders a known simple document to the expected SVG (golden file)", () => {
    expect(writeSvg(squareDocument)).toBe(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10">',
        '  <path id="square" d="M 0,0 L 10,0 L 10,10 L 0,10 Z" fill="none" fill-rule="evenodd" stroke="#000" stroke-width="1"/>',
        "</svg>",
      ].join("\n"),
    );
  });

  it("uses no unit suffix for px and the correct suffix for mm/in", () => {
    const px = writeSvg({ ...squareDocument, unit: "px" });
    expect(px).toContain('width="10" height="10"');

    const mm = writeSvg({ ...squareDocument, unit: "mm" });
    expect(mm).toContain('width="10mm" height="10mm"');

    const inches = writeSvg({ ...squareDocument, unit: "in" });
    expect(inches).toContain('width="10in" height="10in"');
  });

  it("respects stroke/fill/precision options", () => {
    const svg = writeSvg(squareDocument, {
      stroke: "red",
      strokeWidth: 2,
      fill: "blue",
      precision: 0,
    });
    expect(svg).toContain('stroke="red"');
    expect(svg).toContain('stroke-width="2"');
    expect(svg).toContain('fill="blue"');
  });

  it("round-trips a square's geometry through the generated path data", () => {
    const svg = writeSvg(squareDocument);
    const { id, d } = extractPaths(svg)[0]!;
    expect(id).toBe("square");

    const [subpath] = parsePathD(d);
    expect(subpath!.start).toEqual({ x: 0, y: 0 });
    expect(subpath!.closed).toBe(true);
    expect(subpath!.segments).toEqual(squareDocument.shapes[0]!.outer.path.segments);
  });

  it("round-trips outer + hole as two subpaths under fill-rule evenodd", () => {
    const svg = writeSvg(squareWithHoleDocument);
    expect(svg).toContain('fill-rule="evenodd"');

    const { d } = extractPaths(svg)[0]!;
    const subpaths = parsePathD(d);
    expect(subpaths).toHaveLength(2);

    const shape = squareWithHoleDocument.shapes[0]!;
    expect(subpaths[0]!.start).toEqual(shape.outer.path.start);
    expect(subpaths[0]!.segments).toEqual(shape.outer.path.segments);
    expect(subpaths[1]!.start).toEqual(shape.holes[0]!.path.start);
    expect(subpaths[1]!.segments).toEqual(shape.holes[0]!.path.segments);
  });

  it("emits one <path> per shape for multi-object documents", () => {
    const svg = writeSvg(twoSquaresDocument);
    const paths = extractPaths(svg);
    expect(paths.map((p) => p.id)).toEqual(["left", "right"]);
  });

  it("round-trips a cubic segment via the C command", () => {
    const svg = writeSvg(curvedDocument);
    const { d } = extractPaths(svg)[0]!;
    const [subpath] = parsePathD(d);
    expect(subpath!.segments).toEqual(curvedDocument.shapes[0]!.outer.path.segments);
  });

  it("escapes special characters in shape ids", () => {
    const doc = {
      ...squareDocument,
      shapes: [{ ...squareDocument.shapes[0]!, id: 'a"b&c' }],
    };
    const svg = writeSvg(doc);
    expect(svg).toContain('id="a&quot;b&amp;c"');
  });
});

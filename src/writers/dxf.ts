/**
 * DXF output writer (PLAN.md Stage 3): a pure `VectorDocument -> string`
 * function, tested only against hand-built IR fixtures.
 *
 * Library decision (PLAN.md Stage 3, "Decision recorded: hand-rolled vs.
 * third-party DXF writer"): hand-rolled. The only entity this package
 * needs is a closed 2D polyline per contour — every third-party DXF
 * library pulls in far more (blocks, dimensions, full NURBS splines,
 * often a matching parser) than a maker-tool cut/trace outline requires,
 * which conflicts with keeping this package's dependency footprint small
 * (PLAN.md §1). The ASCII DXF R2000 (`AC1015`) group-code format for
 * `LWPOLYLINE` is small and well-documented enough to hand-roll reliably.
 *
 * Emits one `LWPOLYLINE` per `Contour` (outer *and* each hole) on a single
 * layer. That's deliberate, not a simplification of "real" hole support:
 * DXF has no native hole concept for polylines, and for this package's
 * actual use case — laser/CNC cutting — a hole *is* just another closed
 * cut path, which is exactly what a plain `LWPOLYLINE` per contour gives
 * a CAM tool.
 *
 * `LWPOLYLINE` only supports straight vertices, not true cubic curves, so
 * any `cubic` `PathSegment` is flattened to a fixed number of line
 * segments (`bezierSegments`). Emitting genuine `SPLINE` entities for
 * curved segments is deferred — Stage 1 doesn't produce `cubic` segments
 * yet either (see its "curve smoothing" deferral), so there's no real
 * document to validate that against right now.
 */

import type { Point, Unit, VectorDocument, VectorPath } from "../ir/types.js";

export interface DxfWriteOptions {
  /** DXF layer every entity is placed on. Default `"OUTLINE"`. */
  readonly layer?: string;
  /** Decimal places for coordinates. Default 4. */
  readonly precision?: number;
  /** Line segments used to approximate each `cubic` `PathSegment`. Default 16. */
  readonly bezierSegments?: number;
}

/** DXF `$INSUNITS` header codes for the units this package supports. */
const INSUNITS: Record<Unit, number> = {
  px: 0, // unitless
  in: 1,
  mm: 4,
};

function cubicPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/** Flattens a `VectorPath` (straight + cubic segments) to a plain point list `LWPOLYLINE` can encode. */
function flattenPath(path: VectorPath, bezierSegments: number): Point[] {
  const points: Point[] = [path.start];
  let current = path.start;

  for (const segment of path.segments) {
    if (segment.type === "line") {
      points.push(segment.to);
      current = segment.to;
      continue;
    }
    for (let i = 1; i <= bezierSegments; i++) {
      points.push(
        cubicPoint(current, segment.control1, segment.control2, segment.to, i / bezierSegments),
      );
    }
    current = segment.to;
  }

  return points;
}

class DxfWriter {
  private readonly lines: string[] = [];

  pair(code: number, value: string | number): void {
    this.lines.push(String(code), String(value));
  }

  toString(): string {
    return this.lines.join("\n") + "\n";
  }
}

function writeHeader(dxf: DxfWriter, doc: VectorDocument): void {
  dxf.pair(0, "SECTION");
  dxf.pair(2, "HEADER");
  dxf.pair(9, "$ACADVER");
  dxf.pair(1, "AC1015");
  dxf.pair(9, "$INSUNITS");
  dxf.pair(70, INSUNITS[doc.unit]);
  dxf.pair(0, "ENDSEC");
}

function writeTables(dxf: DxfWriter, layer: string): void {
  const layerNames = layer === "0" ? ["0"] : ["0", layer];

  dxf.pair(0, "SECTION");
  dxf.pair(2, "TABLES");
  dxf.pair(0, "TABLE");
  dxf.pair(2, "LAYER");
  dxf.pair(70, layerNames.length);
  for (const name of layerNames) {
    dxf.pair(0, "LAYER");
    dxf.pair(2, name);
    dxf.pair(70, 0);
    dxf.pair(62, 7); // color: white/black (device default)
    dxf.pair(6, "CONTINUOUS");
  }
  dxf.pair(0, "ENDTAB");
  dxf.pair(0, "ENDSEC");
}

function writeEntities(
  dxf: DxfWriter,
  doc: VectorDocument,
  layer: string,
  fmt: (n: number) => string,
  bezierSegments: number,
): void {
  dxf.pair(0, "SECTION");
  dxf.pair(2, "ENTITIES");

  for (const shape of doc.shapes) {
    for (const contour of [shape.outer, ...shape.holes]) {
      const points = flattenPath(contour.path, bezierSegments);
      dxf.pair(0, "LWPOLYLINE");
      dxf.pair(8, layer);
      dxf.pair(90, points.length);
      dxf.pair(70, contour.path.closed ? 1 : 0);
      for (const point of points) {
        dxf.pair(10, fmt(point.x));
        dxf.pair(20, fmt(point.y));
      }
    }
  }

  dxf.pair(0, "ENDSEC");
}

/** Renders `doc` as a complete ASCII DXF (R2000 / `AC1015`) document string. */
export function writeDxf(doc: VectorDocument, options: DxfWriteOptions = {}): string {
  const { layer = "OUTLINE", precision = 4, bezierSegments = 16 } = options;
  const fmt = (n: number): string => n.toFixed(precision);

  const dxf = new DxfWriter();
  writeHeader(dxf, doc);
  writeTables(dxf, layer);
  writeEntities(dxf, doc, layer, fmt, bezierSegments);
  dxf.pair(0, "EOF");

  return dxf.toString();
}

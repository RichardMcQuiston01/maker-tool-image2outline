/**
 * Calibration stage (PLAN.md Stage 2): converts a pixel-space `VectorDocument`
 * (as produced by the vision pipeline, `unit: "px"`) into a real-world-unit
 * `VectorDocument`, and/or normalizes coordinates to CAD convention.
 *
 * A pure `VectorDocument -> VectorDocument` transform, tested only against
 * hand-built IR fixtures — independent of both the vision pipeline and the
 * output writers.
 *
 * Exit criteria (PLAN.md Stage 2): when no calibration input is given, the
 * document passes through unchanged (px passthrough) — `calibrate(doc)`
 * returns the same `doc` reference in that case.
 */

import type {
  HoleContour,
  OuterContour,
  PathSegment,
  Point,
  Unit,
  VectorDocument,
  VectorPath,
  VectorShape,
  Winding,
} from "../ir/types.js";

/** Manual scale input: how many source pixels correspond to one real-world unit. */
export interface ManualScale {
  readonly pixelsPerUnit: number;
  readonly unit: Exclude<Unit, "px">;
}

export interface CalibrationOptions {
  /** Manual scale (DPI-equivalent) to convert pixel coordinates to real-world units. Omit to leave the document in its existing unit. */
  readonly scale?: ManualScale;
  /**
   * Flip Y so it increases upward and move the origin to the bottom-left
   * (CAD convention), instead of image convention (Y down, origin top-left).
   * Default false.
   */
  readonly flipY?: boolean;
}

function flipWinding(winding: Winding): Winding {
  return winding === "clockwise" ? "counterclockwise" : "clockwise";
}

function transformSegment(segment: PathSegment, transform: (p: Point) => Point): PathSegment {
  if (segment.type === "line") {
    return { type: "line", to: transform(segment.to) };
  }
  return {
    type: "cubic",
    control1: transform(segment.control1),
    control2: transform(segment.control2),
    to: transform(segment.to),
  };
}

function transformPath(path: VectorPath, transform: (p: Point) => Point): VectorPath {
  return {
    start: transform(path.start),
    segments: path.segments.map((segment) => transformSegment(segment, transform)),
    closed: path.closed,
  };
}

function transformOuterContour(
  contour: OuterContour,
  transform: (p: Point) => Point,
  flipY: boolean,
): OuterContour {
  return {
    isHole: false,
    winding: flipY ? flipWinding(contour.winding) : contour.winding,
    path: transformPath(contour.path, transform),
  };
}

function transformHoleContour(
  contour: HoleContour,
  transform: (p: Point) => Point,
  flipY: boolean,
): HoleContour {
  return {
    isHole: true,
    winding: flipY ? flipWinding(contour.winding) : contour.winding,
    path: transformPath(contour.path, transform),
  };
}

function transformShape(
  shape: VectorShape,
  transform: (p: Point) => Point,
  flipY: boolean,
): VectorShape {
  return {
    id: shape.id,
    outer: transformOuterContour(shape.outer, transform, flipY),
    holes: shape.holes.map((hole) => transformHoleContour(hole, transform, flipY)),
  };
}

/**
 * Converts `doc` to real-world units and/or CAD coordinate convention.
 * With no options, returns `doc` unchanged (px passthrough).
 */
export function calibrate(doc: VectorDocument, options: CalibrationOptions = {}): VectorDocument {
  const { scale, flipY = false } = options;
  if (!scale && !flipY) {
    return doc;
  }

  if (scale && (!Number.isFinite(scale.pixelsPerUnit) || scale.pixelsPerUnit <= 0)) {
    throw new RangeError("scale.pixelsPerUnit must be a finite number greater than zero");
  }

  const scaleFactor = scale ? 1 / scale.pixelsPerUnit : 1;
  const unit: Unit = scale ? scale.unit : doc.unit;
  const width = doc.width * scaleFactor;
  const height = doc.height * scaleFactor;

  const transform = (p: Point): Point => {
    const x = p.x * scaleFactor;
    const y = p.y * scaleFactor;
    return { x, y: flipY ? height - y : y };
  };

  const shapes = doc.shapes.map((shape) => transformShape(shape, transform, flipY));

  return {
    unit,
    width,
    height,
    shapes,
    ...(doc.metadata ? { metadata: doc.metadata } : {}),
  };
}

/**
 * Automatic reference-marker calibration (ROADMAP.md "Future / stretch",
 * promoted to a shipped feature in v1.1.0): derive a manual scale
 * automatically from a known-size marker placed in the frame, instead of
 * requiring the caller to measure `pixelsPerUnit` themselves.
 *
 * The marker is a solid square of known real-world side length. Detection
 * works directly on the traced polygon's own vertices (side lengths and
 * diagonals), not the axis-aligned bounding box, so the marker doesn't need
 * to be axis-aligned in the photo — an arbitrarily rotated square still
 * measures as "4 sides of equal length with equal diagonals". A skewed
 * quadrilateral (not a square) or a shape with curved segments will not
 * match.
 */

import type { Point, Unit, VectorDocument, VectorPath } from "../ir/types.js";
import type { ManualScale } from "./calibrate.js";

/** Real-world size of a square reference marker placed in the source image. */
export interface ReferenceMarkerSpec {
  /** The marker's real-world side length. */
  readonly size: number;
  readonly unit: Exclude<Unit, "px">;
}

export interface DetectReferenceMarkerOptions {
  /**
   * Maximum relative deviation allowed between a candidate shape's side
   * lengths (from their mean) and between its two diagonals, for it to
   * count as the marker. Default 0.15 (15%) — generous enough for tracing
   * noise on a printed marker, tight enough to reject an unrelated
   * traced object.
   */
  readonly tolerance?: number;
}

const DEFAULT_TOLERANCE = 0.15;

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** A closed polygon's vertices, or `null` if any segment isn't a straight line. */
function polygonVertices(path: VectorPath): Point[] | null {
  const vertices: Point[] = [path.start];
  for (const segment of path.segments) {
    if (segment.type !== "line") return null;
    vertices.push(segment.to);
  }
  return vertices;
}

/** Whether `values` all fall within `tolerance` (relative) of their mean, and that mean. */
function withinRelativeTolerance(values: readonly number[], tolerance: number): number | null {
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (mean <= 0) return null;
  for (const v of values) {
    if (Math.abs(v - mean) / mean > tolerance) return null;
  }
  return mean;
}

/**
 * If `vertices` describes a square (within `tolerance`), returns its mean
 * side length in the document's own coordinate units; otherwise `null`.
 * Works from the polygon's own edge/diagonal lengths, so an arbitrarily
 * rotated square still matches.
 */
function squareSideLength(vertices: readonly Point[], tolerance: number): number | null {
  if (vertices.length !== 4) return null;

  const sides = vertices.map((v, i) => distance(v, vertices[(i + 1) % 4]!));
  const meanSide = withinRelativeTolerance(sides, tolerance);
  if (meanSide === null) return null;

  const diagonals = [distance(vertices[0]!, vertices[2]!), distance(vertices[1]!, vertices[3]!)];
  if (withinRelativeTolerance(diagonals, tolerance) === null) return null;

  return meanSide;
}

/**
 * Finds the single shape in `doc` that matches `spec`'s marker shape (a
 * square, by side/diagonal geometry) and derives a `ManualScale` from its
 * measured pixel size vs. `spec.size`.
 *
 * @throws {RangeError} if `spec.size` isn't a finite number greater than zero.
 * @throws {Error} if no shape matches, or more than one does (ambiguous).
 */
export function detectReferenceMarker(
  doc: VectorDocument,
  spec: ReferenceMarkerSpec,
  options: DetectReferenceMarkerOptions = {},
): { readonly shapeId: string; readonly scale: ManualScale } {
  if (!Number.isFinite(spec.size) || spec.size <= 0) {
    throw new RangeError("referenceMarker.size must be a finite number greater than zero");
  }
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;

  const candidates: { readonly shapeId: string; readonly sidePx: number }[] = [];
  for (const shape of doc.shapes) {
    const vertices = polygonVertices(shape.outer.path);
    if (!vertices) continue;
    const sidePx = squareSideLength(vertices, tolerance);
    if (sidePx !== null) candidates.push({ shapeId: shape.id, sidePx });
  }

  if (candidates.length === 0) {
    throw new Error(
      "No reference marker found: no traced shape matches a square of roughly equal " +
        "sides and diagonals. Check that the marker is fully visible and high-contrast.",
    );
  }
  if (candidates.length > 1) {
    const ids = candidates.map((c) => c.shapeId).join(", ");
    throw new Error(
      `Multiple shapes match the reference marker (ambiguous): ${ids}. Remove the extra ` +
        "square-like shapes from the image, or use manual scale calibration instead.",
    );
  }

  const { shapeId, sidePx } = candidates[0]!;
  return { shapeId, scale: { pixelsPerUnit: sidePx / spec.size, unit: spec.unit } };
}

/** Returns `doc` with the shape matching `shapeId` removed. */
export function excludeShape(doc: VectorDocument, shapeId: string): VectorDocument {
  return { ...doc, shapes: doc.shapes.filter((shape) => shape.id !== shapeId) };
}

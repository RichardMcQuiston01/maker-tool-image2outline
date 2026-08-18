/**
 * Internal vector representation (IR).
 *
 * This is the seam the whole project is organized around (see PLAN.md §2):
 * the vision pipeline (preprocess -> contour trace -> simplify -> calibrate)
 * produces a `VectorDocument`, and each output writer (SVG, DXF, ...) is a
 * pure `VectorDocument -> string` function. Nothing in this file is
 * exported from the package's public entry point (`src/index.ts`) — it is
 * an internal contract between pipeline stages, not part of the consumer
 * API in `src/types.ts`.
 *
 * Changes to these shapes affect every downstream stage (vision,
 * calibration, both writers), so they should be made deliberately — see
 * PLAN.md §4 "Coordination rules".
 */

/** Real-world or pixel unit a `VectorDocument`'s coordinates are expressed in. */
export type Unit = "px" | "mm" | "in";

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * One drawing instruction relative to the current pen position, mirroring
 * the SVG `L`/`C` path commands. `line` covers polyline output from the
 * contour tracer; `cubic` covers optional curve smoothing/fitting.
 */
export type PathSegment =
  | { readonly type: "line"; readonly to: Point }
  | {
      readonly type: "cubic";
      readonly control1: Point;
      readonly control2: Point;
      readonly to: Point;
    };

/** A single traced path: a starting point plus the segments drawn from it. */
export interface VectorPath {
  readonly start: Point;
  readonly segments: readonly PathSegment[];
  /** Whether the path's end connects back to `start` (an outline vs. an open trace). */
  readonly closed: boolean;
}

export type Winding = "clockwise" | "counterclockwise";

/**
 * One traced boundary. `isHole` distinguishes an outer boundary from an
 * inner one (e.g. the inner ring of a traced letter "O") — both are
 * represented as contours so nested-hole detection in Stage 1 (see
 * PLAN.md's Stage 1) has a uniform shape to emit.
 */
export interface Contour {
  readonly path: VectorPath;
  readonly winding: Winding;
  readonly isHole: boolean;
}

/**
 * One detected object in the source image: its outer boundary plus any
 * holes nested inside it. Multi-object images (PLAN.md Stage 1) produce
 * one `VectorShape` per detected object.
 */
export interface VectorShape {
  readonly id: string;
  readonly outer: Contour;
  readonly holes: readonly Contour[];
}

/**
 * The full result of the vision + calibration stages, and the sole input
 * every output writer consumes. `unit` is `"px"` until the calibration
 * stage (PLAN.md Stage 2) has run; writers that require real-world units
 * (e.g. DXF) should treat a `"px"` document as uncalibrated input.
 */
export interface VectorDocument {
  readonly unit: Unit;
  readonly width: number;
  readonly height: number;
  readonly shapes: readonly VectorShape[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

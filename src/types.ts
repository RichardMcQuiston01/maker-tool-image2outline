/**
 * Public API types for `@richardmcquiston/makertool-image2outline`.
 *
 * This is the contract other projects should depend on when embedding
 * this package (PLAN.md §1, "small, typed public surface"). Everything
 * under `src/ir/` and `src/adapters/` is internal, is not exported from
 * `src/index.ts`, and may change without a major version bump.
 */

/**
 * Minimal structural subset of the DOM `ImageData` interface, redeclared
 * here so the package doesn't require the `"dom"` lib (this package must
 * stay usable from plain Node.js as well as the browser — PLAN.md §1,
 * "framework/runtime agnostic core"). Any real `ImageData` instance
 * already satisfies this shape.
 */
export interface ImageLikeData {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/**
 * Accepted image sources: a decoded/encoded byte buffer, a file path,
 * in-memory pixel data, or a URL. `Uint8Array` (not Node's `Buffer`) so
 * this type resolves without Node's ambient types in a browser consumer
 * — a Node `Buffer` is itself a `Uint8Array` and remains assignable here.
 */
export type ImageInput = Uint8Array | string | ImageLikeData | URL;

export type OutputFormat = "svg" | "dxf";

/**
 * Real-world (or pixel) unit for the requested output. Intentionally a
 * separate type from the internal IR's `Unit` (`src/ir/types.ts`) even
 * though the values currently match — the public and internal contracts
 * are allowed to evolve independently (PLAN.md §4, coordination rules).
 */
export type Unit = "px" | "mm" | "in";

/**
 * Manual pixel-to-real-world scale calibration (PLAN.md Stage 2). Applied
 * uniformly to the traced outline: `pixelsPerUnit` pixels in the source
 * image correspond to one `unit`.
 */
export interface ScaleCalibration {
  readonly pixelsPerUnit: number;
  readonly unit: Exclude<Unit, "px">;
}

export interface Image2OutlineOptions {
  /** Which output format(s) to produce; at least one is required. */
  readonly formats: readonly [OutputFormat, ...OutputFormat[]];
  /**
   * Manual scale calibration. When omitted, output coordinates stay in
   * pixel space (`unit: "px"` on the result) — see PLAN.md Stage 2.
   * Automatic reference-marker calibration is a stretch goal (ROADMAP.md,
   * "Future / stretch") and is not part of this option yet.
   */
  readonly scale?: ScaleCalibration;
  /**
   * Flip Y so it increases upward and move the origin to the bottom-left
   * (CAD convention), instead of image convention (Y down, origin
   * top-left). Default false. SVG consumers typically don't need this —
   * SVG is itself Y-down — but DXF/CAD/CAM consumers usually do.
   */
  readonly flipY?: boolean;
}

/** One generated output document, in the requested format. */
export interface OutlineOutput {
  readonly format: OutputFormat;
  readonly content: string;
}

export interface OutlineResult {
  readonly unit: Unit;
  readonly width: number;
  readonly height: number;
  readonly outputs: readonly OutlineOutput[];
}

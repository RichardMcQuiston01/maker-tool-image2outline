/**
 * Shared internal shapes for the vision pipeline (PLAN.md Stage 1).
 *
 * Pixel-space primitives only — nothing here is exported from the
 * package's public entry point (`src/index.ts`) or from the calibrated
 * IR (`src/ir/types.ts`). `VectorDocument` (the IR) is what `pipeline.ts`
 * produces from these.
 */

/** A binarized image: 1 = foreground (the traced object), 0 = background. */
export interface BinaryMask {
  readonly width: number;
  readonly height: number;
  /** Row-major, one byte per pixel. */
  readonly data: Uint8Array;
}

export interface PixelPoint {
  readonly x: number;
  readonly y: number;
}

export interface BBox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/**
 * One 4- or 8-connected region found by `findConnectedRegions` (Stage 1
 * connected-component labeling / hole detection).
 */
export interface PixelRegion {
  /** Flat `y * width + x` indices of every pixel in the region. */
  readonly cells: ReadonlySet<number>;
  /** Topmost, then leftmost, member pixel — the boundary-trace start point. */
  readonly startPoint: PixelPoint;
  readonly bbox: BBox;
}

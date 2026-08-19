/**
 * Image-decode adapter interface.
 *
 * Platform-specific image loading (Node file/Buffer decoding, browser
 * `ImageData`/canvas decoding, ...) sits behind this interface so the
 * vision pipeline in `src/ir/` never imports a platform-specific module
 * directly (PLAN.md §1, "framework/runtime agnostic core"). A Node
 * implementation lands in Stage 1 (PLAN.md Stage 1); a browser
 * implementation is future work (ROADMAP.md, "Future / stretch").
 *
 * This is an internal contract, not exported from `src/index.ts`.
 */

import type { ImageInput } from "../types.js";

/** Decoded raster image: RGBA pixel data, 4 bytes per pixel, row-major, top-to-bottom. */
export interface DecodedImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface ImageDecodeAdapter {
  decode(input: ImageInput): Promise<DecodedImage>;
}

/**
 * Public entry point for `@richardmcquiston/makertool-image2outline`.
 *
 * One function, one options type, one result type — see PLAN.md §1
 * ("small, typed public surface"). The pipeline itself (Stages 1-4 in
 * PLAN.md) is not implemented yet; this stub exists so the public
 * signature is fixed before that work starts, per the Stage 0 exit
 * criteria in PLAN.md.
 */

export type {
  Image2OutlineOptions,
  ImageInput,
  ImageLikeData,
  OutlineOutput,
  OutlineResult,
  OutputFormat,
  ScaleCalibration,
  Unit,
} from "./types.js";

import type { Image2OutlineOptions, ImageInput, OutlineResult } from "./types.js";

/**
 * Trace the object(s) in `input` and produce a vector outline in the
 * requested format(s).
 *
 * @throws Currently always throws — the vision/calibration/writer
 * pipeline lands in later stages (see ROADMAP.md M1-M4).
 */
export async function image2outline(
  input: ImageInput,
  options: Image2OutlineOptions,
): Promise<OutlineResult> {
  void input;
  void options;
  throw new Error(
    "image2outline() is not implemented yet — the public API is frozen (Stage 0) " +
      "but the pipeline lands in later stages, see ROADMAP.md.",
  );
}

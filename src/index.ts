/**
 * Public entry point for `@richardmcquiston/makertool-image2outline`.
 *
 * One function, one options type, one result type — see PLAN.md §1
 * ("small, typed public surface"). This wires the Stage 1-3 pipeline
 * (decode -> vision -> calibrate -> write) behind that stable signature
 * (PLAN.md Stage 4). The Node image-decode adapter is hardwired here —
 * it's the only concrete adapter (`src/adapters/`) that exists yet; a
 * browser build would substitute a different adapter at this same seam
 * without touching `src/vision/`, `src/calibration/`, or `src/writers/`
 * (PLAN.md §1, "framework/runtime agnostic core").
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

import { nodeImageDecodeAdapter } from "./adapters/node.js";
import { calibrate } from "./calibration/calibrate.js";
import type { Image2OutlineOptions, ImageInput, OutlineOutput, OutlineResult } from "./types.js";
import { traceImage } from "./vision/pipeline.js";
import { writeDxf } from "./writers/dxf.js";
import { writeSvg } from "./writers/svg.js";

/**
 * Trace the object(s) in `input` and produce a vector outline in the
 * requested format(s).
 */
export async function image2outline(
  input: ImageInput,
  options: Image2OutlineOptions,
): Promise<OutlineResult> {
  if (options.formats.length === 0) {
    throw new RangeError("options.formats must include at least one output format");
  }

  const decoded = await nodeImageDecodeAdapter.decode(input);
  const pixelDoc = traceImage(decoded);
  const doc = calibrate(pixelDoc, {
    ...(options.scale ? { scale: options.scale } : {}),
    ...(options.flipY !== undefined ? { flipY: options.flipY } : {}),
  });

  const outputs: OutlineOutput[] = options.formats.map((format) => {
    switch (format) {
      case "svg":
        return { format, content: writeSvg(doc) };
      case "dxf":
        return { format, content: writeDxf(doc) };
    }
  });

  return { unit: doc.unit, width: doc.width, height: doc.height, outputs };
}

/**
 * Node.js image-decode adapter (PLAN.md Stage 1): decodes any raster
 * format `sharp` supports (JPEG, PNG, WebP, TIFF, ...) to RGBA pixel
 * data. This is the only file in the vision pipeline that depends on a
 * Node-specific library — everything downstream (`src/vision/`) operates
 * on plain `DecodedImage` pixel arrays (PLAN.md §1, "framework/runtime
 * agnostic core"). A browser adapter is future work (ROADMAP.md,
 * "Future / stretch").
 */

import { fileURLToPath } from "node:url";

import sharp from "sharp";

import type { ImageInput, ImageLikeData } from "../types.js";
import type { DecodedImage, ImageDecodeAdapter } from "./types.js";

function isImageLikeData(input: ImageInput): input is ImageLikeData {
  return (
    typeof input === "object" &&
    input !== null &&
    !(input instanceof Uint8Array) &&
    !(input instanceof URL)
  );
}

function toSharpInput(input: ImageInput) {
  if (typeof input === "string") {
    return sharp(input);
  }
  if (input instanceof URL) {
    if (input.protocol !== "file:") {
      throw new Error(
        `nodeImageDecodeAdapter only supports "file:" URLs, got "${input.protocol}". ` +
          "Fetch remote images yourself and pass the resulting bytes instead.",
      );
    }
    return sharp(fileURLToPath(input));
  }
  if (input instanceof Uint8Array) {
    return sharp(Buffer.from(input));
  }
  if (isImageLikeData(input)) {
    const { width, height, data } = input;
    return sharp(Buffer.from(data.buffer, data.byteOffset, data.byteLength), {
      raw: { width, height, channels: 4 },
    });
  }
  throw new Error("Unsupported image input");
}

export const nodeImageDecodeAdapter: ImageDecodeAdapter = {
  async decode(input: ImageInput): Promise<DecodedImage> {
    const { data, info } = await toSharpInput(input)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return {
      width: info.width,
      height: info.height,
      data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
    };
  },
};

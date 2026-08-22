/**
 * Preprocessing sub-step of the Stage 1 vision pipeline (PLAN.md Stage 1):
 * grayscale -> denoise -> Otsu threshold/binarize -> orient which side of
 * the threshold is "foreground". Each step is exported and independently
 * testable, per the Stage 1 exit criteria.
 */

import type { DecodedImage } from "../adapters/types.js";
import type { BinaryMask } from "./types.js";

export interface PreprocessOptions {
  /** Box-blur radius in pixels used to denoise before thresholding. 0 disables. Default 1. */
  readonly blurRadius?: number;
}

/** Rec. 709 luma: a single grayscale intensity per pixel, in [0, 255]. */
export function toGrayscale(image: DecodedImage): Float64Array {
  const { width, height, data } = image;
  const out = new Float64Array(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    const r = data[p]!;
    const g = data[p + 1]!;
    const b = data[p + 2]!;
    out[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  return out;
}

/** Simple box blur (mean filter), used to denoise before thresholding. */
export function boxBlur(
  gray: Float64Array,
  width: number,
  height: number,
  radius: number,
): Float64Array {
  if (radius <= 0) return gray;

  const out = new Float64Array(gray.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          sum += gray[ny * width + nx]!;
          count++;
        }
      }
      out[y * width + x] = sum / count;
    }
  }
  return out;
}

/** Otsu's method: the intensity threshold in [0, 255] maximizing between-class variance. */
export function otsuThreshold(gray: Float64Array): number {
  const histogram = new Array<number>(256).fill(0);
  for (const v of gray) {
    const bucket = Math.max(0, Math.min(255, Math.round(v)));
    histogram[bucket] = histogram[bucket]! + 1;
  }

  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * histogram[t]!;

  let sumForeground = 0;
  let weightBelow = 0;
  let maxVariance = 0;
  let threshold = 0;

  for (let t = 0; t < 256; t++) {
    weightBelow += histogram[t]!;
    if (weightBelow === 0) continue;
    const weightAbove = total - weightBelow;
    if (weightAbove === 0) break;

    sumForeground += t * histogram[t]!;
    const meanBelow = sumForeground / weightBelow;
    const meanAbove = (sum - sumForeground) / weightAbove;
    const variance = weightBelow * weightAbove * (meanBelow - meanAbove) * (meanBelow - meanAbove);

    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  return threshold;
}

/**
 * Thresholds `gray` at `threshold` (darker-or-equal = class "dark"), then
 * flips the mask if needed so `1` consistently means "the traced object"
 * rather than "the background" — determined by sampling the image border:
 * whichever class dominates the border is assumed to be the background.
 */
export function binarize(
  gray: Float64Array,
  width: number,
  height: number,
  threshold: number,
): BinaryMask {
  const data = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    data[i] = gray[i]! <= threshold ? 1 : 0;
  }
  return orientForeground({ width, height, data });
}

function orientForeground(mask: BinaryMask): BinaryMask {
  const { width, height, data } = mask;
  let borderOnes = 0;
  let borderTotal = 0;

  const sample = (x: number, y: number): void => {
    borderTotal++;
    if (data[y * width + x] === 1) borderOnes++;
  };
  for (let x = 0; x < width; x++) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    sample(0, y);
    sample(width - 1, y);
  }

  const darkClassIsBackground = borderTotal > 0 && borderOnes / borderTotal > 0.5;
  if (!darkClassIsBackground) return mask;

  const flipped = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) flipped[i] = data[i] === 1 ? 0 : 1;
  return { width, height, data: flipped };
}

/** Full preprocessing pipeline: `DecodedImage` -> foreground `BinaryMask`. */
export function preprocess(image: DecodedImage, options: PreprocessOptions = {}): BinaryMask {
  const { blurRadius = 1 } = options;
  const gray = boxBlur(toGrayscale(image), image.width, image.height, blurRadius);
  const threshold = otsuThreshold(gray);
  return binarize(gray, image.width, image.height, threshold);
}

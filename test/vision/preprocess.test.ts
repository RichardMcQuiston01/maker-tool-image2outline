import { describe, expect, it } from "vitest";

import type { DecodedImage } from "../../src/adapters/types.js";
import {
  binarize,
  boxBlur,
  otsuThreshold,
  preprocess,
  toGrayscale,
} from "../../src/vision/preprocess.js";

/** Builds a DecodedImage by mapping each row of `rows` (0 = white, 1 = black) to RGBA pixels. */
function buildImage(rows: readonly (readonly (0 | 1)[])[]): DecodedImage {
  const height = rows.length;
  const width = rows[0]!.length;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = rows[y]![x]! === 1 ? 0 : 255;
      const p = (y * width + x) * 4;
      data[p] = value;
      data[p + 1] = value;
      data[p + 2] = value;
      data[p + 3] = 255;
    }
  }
  return { width, height, data };
}

describe("toGrayscale", () => {
  it("maps pure white to 255 and pure black to 0", () => {
    const image = buildImage([
      [0, 1],
      [1, 0],
    ]);
    const gray = toGrayscale(image);
    expect(Array.from(gray).map((v) => Math.round(v))).toEqual([255, 0, 0, 255]);
  });
});

describe("toGrayscale with transparency", () => {
  it("reads a fully transparent pixel as white regardless of its RGB", () => {
    // Transparent black (data=0,0,0,alpha=0) vs. opaque black (alpha=255):
    // without alpha compositing these are indistinguishable and an
    // all-transparent image would be misread as an all-dark foreground.
    const data = new Uint8ClampedArray(8);
    data[0] = 0;
    data[1] = 0;
    data[2] = 0;
    data[3] = 0; // transparent black
    data[4] = 0;
    data[5] = 0;
    data[6] = 0;
    data[7] = 255; // opaque black
    const gray = toGrayscale({ width: 2, height: 1, data });
    expect(Math.round(gray[0]!)).toBe(255);
    expect(Math.round(gray[1]!)).toBe(0);
  });
});

describe("boxBlur", () => {
  it("is a no-op for radius 0", () => {
    const gray = new Float64Array([1, 2, 3, 4]);
    expect(boxBlur(gray, 2, 2, 0)).toBe(gray);
  });

  it("averages a uniform field to itself", () => {
    const gray = new Float64Array(9).fill(100);
    const blurred = boxBlur(gray, 3, 3, 1);
    expect(Array.from(blurred)).toEqual(Array.from({ length: 9 }, () => 100));
  });

  it("rejects a non-integer, negative, or non-finite radius", () => {
    const gray = new Float64Array(4);
    expect(() => boxBlur(gray, 2, 2, 1.5)).toThrow(RangeError);
    expect(() => boxBlur(gray, 2, 2, -1)).toThrow(RangeError);
    expect(() => boxBlur(gray, 2, 2, Infinity)).toThrow(RangeError);
  });
});

describe("otsuThreshold", () => {
  it("splits a strictly bimodal histogram between the two modes", () => {
    const gray = new Float64Array([...Array(10).fill(10), ...Array(10).fill(200)]);
    // The optimal split is anywhere in [10, 199]; ties resolve to the lowest
    // such threshold, so 10 itself is a valid (and expected) result.
    const threshold = otsuThreshold(gray);
    expect(threshold).toBeGreaterThanOrEqual(10);
    expect(threshold).toBeLessThan(200);
  });
});

describe("binarize", () => {
  it("orients the mask so the border-dominant class becomes background (0)", () => {
    // 5x5, all white except a 1x1 black pixel in the center.
    const rows = [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ] as const;
    const gray = toGrayscale(buildImage(rows));
    const mask = binarize(gray, 5, 5, 127);
    expect(Array.from(mask.data)).toEqual(rows.flat());
  });

  it("flips the mask when the darker class dominates the border", () => {
    // Inverse: black border, white center square — darker class (black) is
    // the border-dominant one, so it must become background (0) regardless
    // of which side of the threshold it started on.
    const rows = [
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ] as const;
    const gray = toGrayscale(buildImage(rows));
    const mask = binarize(gray, 5, 5, 127);
    // Foreground (1) should be the white center, not the black border.
    expect(Array.from(mask.data)).toEqual(rows.map((r) => r.map((v) => (v === 0 ? 1 : 0))).flat());
  });
});

describe("preprocess", () => {
  it("produces a foreground mask matching a simple dark object on a light background", () => {
    const rows = [
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 1, 1, 0, 0],
      [0, 0, 1, 1, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ] as const;
    const image = buildImage(rows);
    const mask = preprocess(image, { blurRadius: 0 });
    expect(Array.from(mask.data)).toEqual(rows.flat());
  });
});

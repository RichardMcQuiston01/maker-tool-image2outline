import { describe, expect, it } from "vitest";

import type { DecodedImage } from "../../src/adapters/types.js";
import {
  binarize,
  boxBlur,
  otsuThreshold,
  preprocess,
  toGrayscale,
  toThresholdIntensity,
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

/** Builds a DecodedImage by mapping each pixel's (x, y) to an [r, g, b] triple. */
function buildRgbImage(
  width: number,
  height: number,
  colorAt: (x: number, y: number) => readonly [number, number, number],
): DecodedImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = colorAt(x, y);
      const p = (y * width + x) * 4;
      data[p] = r;
      data[p + 1] = g;
      data[p + 2] = b;
      data[p + 3] = 255;
    }
  }
  return { width, height, data };
}

describe("toThresholdIntensity", () => {
  it("matches toGrayscale exactly for grayscale (chroma-free) content", () => {
    const image = buildImage([
      [0, 1],
      [1, 0],
    ]);
    expect(Array.from(toThresholdIntensity(image))).toEqual(Array.from(toGrayscale(image)));
  });

  it("pulls a saturated bright color's intensity down toward its true darkness", () => {
    // Pure yellow (255,255,0): luma alone (~236.6) reads almost as bright as
    // white background, but chroma (255) is maximal — subtracting it lands
    // well below the object's own dark-red intensity below, matching the
    // real failure this fixes: a saturated color misread as background
    // purely because it happens to be luminous.
    const image = buildRgbImage(2, 1, (x) => (x === 0 ? [255, 255, 0] : [200, 0, 0]));
    const intensity = toThresholdIntensity(image);
    expect(intensity[0]!).toBeLessThan(50);
    expect(toGrayscale(image)[0]!).toBeGreaterThan(200); // luma alone would call it bright
  });

  it("reads a fully transparent pixel as white regardless of its RGB", () => {
    const data = new Uint8ClampedArray(4);
    data[3] = 0; // transparent, RGB all 0
    const intensity = toThresholdIntensity({ width: 1, height: 1, data });
    expect(Math.round(intensity[0]!)).toBe(255);
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

  it("classifies by rounded intensity, matching how otsuThreshold buckets its histogram", () => {
    // otsuThreshold groups raw values into integer buckets via Math.round
    // before finding its optimal split, so its returned threshold is only
    // meaningful against that same rounding — comparing a raw float
    // directly against it (the old behavior) could split a single cluster
    // of same-valued pixels across the threshold by sub-integer noise
    // alone. 100.3 rounds to 100, so at threshold 100 it must land in the
    // dark/foreground class even though the raw value itself exceeds 100.
    const gray = new Float64Array([100.3, 101.0]);
    const mask = binarize(gray, 2, 1, 100);
    expect(Array.from(mask.data)).toEqual([1, 0]);
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

  it("keeps a saturated highlight band as part of the object instead of biting it off as background", () => {
    // Reproduces a real reported bug: a photographed object (e.g. a glossy
    // red/yellow tool handle) with a bright specular highlight along one
    // edge came back with that edge missing from the traced outline.
    // White background; a 10x10 dark-red object at (5,5)-(14,14); its top
    // row replaced with a bright-but-still-saturated highlight color whose
    // luma alone (~213) reads nearly as light as the white background
    // (255) — plain luma-based Otsu thresholding puts that row on the
    // background side, notching it out of the silhouette.
    const size = 20;
    const objectColor: readonly [number, number, number] = [220, 80, 20];
    const highlightColor: readonly [number, number, number] = [250, 210, 140];
    const image = buildRgbImage(size, size, (x, y) => {
      const inObject = x >= 5 && x <= 14 && y >= 5 && y <= 14;
      if (!inObject) return [255, 255, 255];
      return y === 5 ? highlightColor : objectColor;
    });

    const mask = preprocess(image, { blurRadius: 0 });

    for (let x = 5; x <= 14; x++) {
      expect(mask.data[5 * size + x]).toBe(1); // the highlight row itself
      expect(mask.data[6 * size + x]).toBe(1); // sanity: the row below it
    }
  });
});

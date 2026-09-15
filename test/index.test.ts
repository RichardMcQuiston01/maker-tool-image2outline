import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { image2outline } from "../src/index.js";
import type { Image2OutlineOptions } from "../src/index.js";

/** Synthesizes a PNG: a solid black square on a white background. */
async function synthesizeSquarePng(
  size: number,
  squareStart: number,
  squareEnd: number,
): Promise<Buffer> {
  const channels = 3;
  const data = Buffer.alloc(size * size * channels, 255);
  for (let y = squareStart; y < squareEnd; y++) {
    for (let x = squareStart; x < squareEnd; x++) {
      const p = (y * size + x) * channels;
      data[p] = 0;
      data[p + 1] = 0;
      data[p + 2] = 0;
    }
  }
  return sharp(data, { raw: { width: size, height: size, channels } })
    .png()
    .toBuffer();
}

/** Synthesizes a PNG with a square "marker" plus a separate circle "object". */
async function synthesizeMarkerAndCirclePng(size: number): Promise<Buffer> {
  const channels = 3;
  const data = Buffer.alloc(size * size * channels, 255);
  const paint = (x: number, y: number): void => {
    const p = (y * size + x) * channels;
    data[p] = 0;
    data[p + 1] = 0;
    data[p + 2] = 0;
  };

  // Marker: a 40x40px square in a corner, sized well above blur/simplification noise.
  for (let y = 10; y < 50; y++) {
    for (let x = 10; x < 50; x++) paint(x, y);
  }

  // Object: a circle of radius 40px centered away from the marker.
  const cx = 140;
  const cy = 140;
  const r = 40;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) paint(x, y);
    }
  }

  return sharp(data, { raw: { width: size, height: size, channels } })
    .png()
    .toBuffer();
}

/**
 * Synthesizes a PNG of a solid black object on white, with a few tiny white
 * "printed logo/text" specks punched inside it plus one much larger
 * legitimate hole — modeled on a real photographed tool whose printed
 * branding/model number binarized into spurious tiny holes (see
 * `traceComponent`'s `DEFAULT_MIN_HOLE_AREA_RATIO`).
 */
async function synthesizeObjectWithSpeckledLogoPng(size: number): Promise<Buffer> {
  const channels = 3;
  const data = Buffer.alloc(size * size * channels, 255);
  const paint = (x: number, y: number, value: number): void => {
    const p = (y * size + x) * channels;
    data[p] = value;
    data[p + 1] = value;
    data[p + 2] = value;
  };

  // Solid black object body: 160x160.
  for (let y = 20; y < 180; y++) {
    for (let x = 20; x < 180; x++) paint(x, y, 0);
  }

  // Tiny "printed logo/text" specks: 4x4 each, ~0.06% of the object's area.
  for (const [ox, oy] of [
    [40, 40],
    [80, 40],
    [120, 40],
    [40, 80],
  ]) {
    for (let y = oy!; y < oy! + 4; y++) {
      for (let x = ox!; x < ox! + 4; x++) paint(x, y, 255);
    }
  }

  // One genuinely large hole: 40x40, ~6% of the object's area.
  for (let y = 120; y < 160; y++) {
    for (let x = 120; x < 160; x++) paint(x, y, 255);
  }

  return sharp(data, { raw: { width: size, height: size, channels } })
    .png()
    .toBuffer();
}

/**
 * Synthesizes a PNG of a solid object on white with a saturated highlight
 * band along its top edge — modeled on a real photographed tool whose
 * glossy handle had a bright specular highlight along one side. Its luma
 * alone reads nearly as light as the white background; see
 * `preprocess.ts`'s `toThresholdIntensity`.
 */
async function synthesizeObjectWithEdgeHighlightPng(size: number): Promise<Buffer> {
  const channels = 3;
  const data = Buffer.alloc(size * size * channels, 255);
  const paint = (x: number, y: number, [r, g, b]: readonly [number, number, number]): void => {
    const p = (y * size + x) * channels;
    data[p] = r;
    data[p + 1] = g;
    data[p + 2] = b;
  };

  const objectColor: readonly [number, number, number] = [220, 80, 20];
  const highlightColor: readonly [number, number, number] = [250, 210, 140];
  for (let y = 20; y <= 79; y++) {
    for (let x = 20; x <= 79; x++) {
      paint(x, y, y <= 25 ? highlightColor : objectColor);
    }
  }

  return sharp(data, { raw: { width: size, height: size, channels } })
    .png()
    .toBuffer();
}

/** Synthesizes a PNG containing only a square marker, no other shapes. */
async function synthesizeMarkerOnlyPng(size: number): Promise<Buffer> {
  const channels = 3;
  const data = Buffer.alloc(size * size * channels, 255);
  for (let y = 10; y < 50; y++) {
    for (let x = 10; x < 50; x++) {
      const p = (y * size + x) * channels;
      data[p] = 0;
      data[p + 1] = 0;
      data[p + 2] = 0;
    }
  }
  return sharp(data, { raw: { width: size, height: size, channels } })
    .png()
    .toBuffer();
}

describe("image2outline", () => {
  it("is exported with the frozen public signature", () => {
    expect(typeof image2outline).toBe("function");
  });

  it("traces a synthesized image end-to-end to a pixel-space SVG (Stage 4 exit criteria)", async () => {
    const png = await synthesizeSquarePng(20, 5, 15);
    const options: Image2OutlineOptions = { formats: ["svg"] };
    const result = await image2outline(png, options);

    expect(result.unit).toBe("px");
    expect(result.width).toBe(20);
    expect(result.height).toBe(20);
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]!.format).toBe("svg");
    expect(result.outputs[0]!.content).toContain("<svg");
    expect(result.outputs[0]!.content).toContain("<path");
  });

  it("produces both formats in one call, and applies manual scale calibration", async () => {
    const png = await synthesizeSquarePng(20, 5, 15);
    const options: Image2OutlineOptions = {
      formats: ["svg", "dxf"],
      scale: { pixelsPerUnit: 2, unit: "mm" },
    };
    const result = await image2outline(png, options);

    expect(result.unit).toBe("mm");
    expect(result.width).toBe(10);
    expect(result.height).toBe(10);
    expect(result.outputs.map((o) => o.format)).toEqual(["svg", "dxf"]);

    const svg = result.outputs.find((o) => o.format === "svg")!;
    expect(svg.content).toContain('width="10mm"');

    const dxf = result.outputs.find((o) => o.format === "dxf")!;
    expect(dxf.content).toContain("LWPOLYLINE");
  });

  it("applies flipY normalization to CAD convention", async () => {
    const png = await synthesizeSquarePng(20, 5, 15);
    const withoutFlip = await image2outline(png, { formats: ["dxf"] });
    const withFlip = await image2outline(png, { formats: ["dxf"], flipY: true });

    expect(withoutFlip.outputs[0]!.content).not.toEqual(withFlip.outputs[0]!.content);
  });

  it("rejects an empty formats list instead of silently producing no output", async () => {
    // `formats` is a non-empty tuple at the type level, so this can only be
    // reached by a JS (not TS) caller — simulated here via an unsafe cast.
    const png = await synthesizeSquarePng(20, 5, 15);
    const options = { formats: [] } as unknown as Image2OutlineOptions;
    await expect(image2outline(png, options)).rejects.toThrow(RangeError);
  });

  it("rejects an unsupported format instead of silently including an undefined output", async () => {
    // `OutputFormat` is a closed union at the type level, so this can only
    // be reached by a JS (not TS) caller — simulated via an unsafe cast.
    const png = await synthesizeSquarePng(20, 5, 15);
    const options = { formats: ["pdf"] } as unknown as Image2OutlineOptions;
    await expect(image2outline(png, options)).rejects.toThrow(RangeError);
  });

  it("derives scale automatically from a reference marker and excludes it from the output", async () => {
    const png = await synthesizeMarkerAndCirclePng(200);
    const result = await image2outline(png, {
      formats: ["svg"],
      referenceMarker: { size: 5, unit: "mm" },
    });

    // Marker measures ~40px = 5mm (pixelsPerUnit ~= 8); the 200x200px image
    // scales to ~25x25mm regardless of which shapes remain. Blur/simplify
    // perturb the traced marker slightly, so allow a generous tolerance
    // rather than an exact match — this test is about the wiring
    // (detection -> exclusion -> calibration), not geometric precision,
    // which the referenceMarker unit tests already cover exactly.
    expect(result.unit).toBe("mm");
    expect(result.width).toBeGreaterThan(20);
    expect(result.width).toBeLessThan(30);
    expect(result.height).toBeGreaterThan(20);
    expect(result.height).toBeLessThan(30);

    // Only the circle "object" should remain — the marker was excluded.
    const svg = result.outputs[0]!.content;
    expect(svg.match(/<path/g)).toHaveLength(1);
  });

  it("rejects specifying both scale and referenceMarker", async () => {
    const png = await synthesizeMarkerAndCirclePng(200);
    await expect(
      image2outline(png, {
        formats: ["svg"],
        scale: { pixelsPerUnit: 2, unit: "mm" },
        referenceMarker: { size: 5, unit: "mm" },
      }),
    ).rejects.toThrow(RangeError);
  });

  it("ignores tiny printed-logo-sized specks but keeps a genuinely large hole", async () => {
    const png = await synthesizeObjectWithSpeckledLogoPng(200);
    const result = await image2outline(png, { formats: ["dxf"] });

    // DXF writes one LWPOLYLINE per contour (outer + each hole) — see
    // src/writers/dxf.ts. Exactly 2 means the outer silhouette plus the one
    // real hole; the four printed-logo specks were correctly dropped as
    // noise rather than traced as spurious holes.
    const dxf = result.outputs[0]!.content;
    expect(dxf.match(/LWPOLYLINE/g)).toHaveLength(2);
  });

  it("keeps a saturated edge highlight instead of biting it off as background", async () => {
    const png = await synthesizeObjectWithEdgeHighlightPng(100);
    const result = await image2outline(png, { formats: ["dxf"] });

    // Parse every Y coordinate (DXF group code 20) out of the outer
    // LWPOLYLINE to find the traced silhouette's topmost extent.
    const dxf = result.outputs[0]!.content;
    const lines = dxf
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const ys: number[] = [];
    for (let i = 0; i + 1 < lines.length; i++) {
      if (lines[i] === "20") ys.push(parseFloat(lines[i + 1]!));
    }

    // The highlight band spans y=20..25 in source pixels; without the fix
    // the whole band reads as background and the traced top edge stops
    // around y=26. Default blurRadius smooths the outermost pixel row of
    // any sharp edge (an expected, unrelated tradeoff), so allow a couple
    // pixels of slack rather than requiring an exact y=20.
    expect(Math.min(...ys)).toBeLessThanOrEqual(22);
  });

  it("rejects an image where nothing remains after removing the reference marker", async () => {
    const png = await synthesizeMarkerOnlyPng(100);
    await expect(
      image2outline(png, { formats: ["svg"], referenceMarker: { size: 5, unit: "mm" } }),
    ).rejects.toThrow(/no shapes remain/i);
  });
});

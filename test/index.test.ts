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
});

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { nodeImageDecodeAdapter } from "../../src/adapters/node.js";
import { traceImage } from "../../src/vision/pipeline.js";

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

describe("nodeImageDecodeAdapter", () => {
  it("decodes a PNG buffer to RGBA pixel data of the right dimensions", async () => {
    const png = await synthesizeSquarePng(16, 4, 12);
    const decoded = await nodeImageDecodeAdapter.decode(png);

    expect(decoded.width).toBe(16);
    expect(decoded.height).toBe(16);
    expect(decoded.data.length).toBe(16 * 16 * 4);

    // A pixel inside the black square should decode to (0,0,0,255).
    const insideOffset = (8 * 16 + 8) * 4;
    expect(Array.from(decoded.data.slice(insideOffset, insideOffset + 4))).toEqual([0, 0, 0, 255]);

    // A pixel outside it should decode to white.
    const outsideOffset = (1 * 16 + 1) * 4;
    expect(Array.from(decoded.data.slice(outsideOffset, outsideOffset + 4))).toEqual([
      255, 255, 255, 255,
    ]);
  });

  it("decodes an ImageLikeData (raw RGBA) input", async () => {
    const width = 3;
    const height = 3;
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    // Center pixel black, fully opaque.
    const p = (1 * width + 1) * 4;
    data[p] = 0;
    data[p + 1] = 0;
    data[p + 2] = 0;
    data[p + 3] = 255;

    const decoded = await nodeImageDecodeAdapter.decode({ width, height, data });
    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    expect(Array.from(decoded.data.slice(p, p + 4))).toEqual([0, 0, 0, 255]);
  });

  it("rejects non-file: URLs with a clear error", async () => {
    await expect(
      nodeImageDecodeAdapter.decode(new URL("https://example.com/a.png")),
    ).rejects.toThrow(/only supports "file:" URLs/);
  });

  it("end-to-end: decodes a synthesized PNG and traces it to a single closed shape", async () => {
    const png = await synthesizeSquarePng(20, 5, 15);
    const decoded = await nodeImageDecodeAdapter.decode(png);
    const doc = traceImage(decoded, { blurRadius: 0, simplifyEpsilon: 1 });

    expect(doc.width).toBe(20);
    expect(doc.height).toBe(20);
    expect(doc.shapes).toHaveLength(1);
    expect(doc.shapes[0]!.holes).toHaveLength(0);
    expect(doc.shapes[0]!.outer.path.closed).toBe(true);
  });
});

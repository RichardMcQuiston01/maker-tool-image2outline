#!/usr/bin/env node
/**
 * Minimal Node usage example (PLAN.md Stage 4) for
 * `@richardmcquiston01/makertool-image2outline`: reads an image file, runs
 * it through `image2outline()`, and writes an `.svg` and/or `.dxf` file
 * alongside it.
 *
 * Run `npm run build` first (this imports the built package, the same way
 * a consuming project would), then:
 *
 *   node examples/basic-usage.mjs <input-image> [--mm-per-px N] [--flip-y]
 *
 * See examples/README.md for details.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

import { image2outline } from "../dist/index.js";

function parseArgs(argv) {
  const [inputPath, ...rest] = argv;
  if (!inputPath) {
    console.error("Usage: node examples/basic-usage.mjs <input-image> [--mm-per-px N] [--flip-y]");
    process.exit(1);
  }

  let pixelsPerMm;
  let flipY = false;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--mm-per-px") {
      const raw = rest[i + 1];
      const mmPerPx = raw === undefined ? NaN : Number(raw);
      if (!Number.isFinite(mmPerPx) || mmPerPx <= 0) {
        console.error(`--mm-per-px requires a positive number, got ${raw ?? "(nothing)"}`);
        process.exit(1);
      }
      pixelsPerMm = 1 / mmPerPx;
      i++;
    } else if (rest[i] === "--flip-y") {
      flipY = true;
    }
  }

  return { inputPath, pixelsPerMm, flipY };
}

async function main() {
  const { inputPath, pixelsPerMm, flipY } = parseArgs(process.argv.slice(2));

  const result = await image2outline(inputPath, {
    formats: ["svg", "dxf"],
    ...(pixelsPerMm ? { scale: { pixelsPerUnit: pixelsPerMm, unit: "mm" } } : {}),
    flipY,
  });

  console.log(
    `Traced ${inputPath}: ${result.width}${result.unit} x ${result.height}${result.unit}`,
  );

  const { dir, name } = path.parse(inputPath);
  for (const output of result.outputs) {
    const outPath = path.join(dir, `${name}.${output.format}`);
    await writeFile(outPath, output.content);
    console.log(`  wrote ${outPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

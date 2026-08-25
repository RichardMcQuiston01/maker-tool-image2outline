# @richardmcquiston01/makertool-image2outline

## Overview

Framework agnostic TypeScript NPM package that can generate an outline(DXF and/or SVG) of an object from an image. This should be easily incorporated into other projects such that the image source could be a Camera Photo, Scanned image, or otherwise.

## Getting Started

### Prerequisites

- Node.js 18 or later.
- Currently a Node-only package (image decoding is backed by
  [`sharp`](https://sharp.pixelplumbing.com/)). A browser adapter is
  planned but not yet available — see `ROADMAP.md`.

### Installation

```sh
npm install @richardmcquiston01/makertool-image2outline
```

### Usage

The package has a single entry point, `image2outline()`. Pass it an image
(a file path, a `Buffer`/`Uint8Array`, a `file:` URL, or raw
`{ width, height, data }` pixel data) and the output format(s) you want:

```ts
import { writeFile } from "node:fs/promises";
import { image2outline } from "@richardmcquiston01/makertool-image2outline";

const result = await image2outline("photo.png", { formats: ["svg", "dxf"] });

for (const output of result.outputs) {
  await writeFile(`outline.${output.format}`, output.content);
}
```

With no further options, the traced outline stays in pixel space
(`result.unit === "px"`). To get real-world dimensions — needed for laser
cutters, CNC, and most CAD workflows — pass a manual scale:

```ts
const result = await image2outline("photo.png", {
  formats: ["dxf"],
  // 10 source pixels = 1 millimeter
  scale: { pixelsPerUnit: 10, unit: "mm" },
  // Normalize to CAD convention (Y up, origin bottom-left).
  // SVG doesn't need this — SVG is itself Y-down.
  flipY: true,
});
```

See the generated API docs (`npm run docs`, below) for the full
`Image2OutlineOptions`/`OutlineResult` shape.

### Examples

A complete, runnable example lives in [`examples/`](./examples) —
`examples/basic-usage.mjs` is a small CLI that traces an image and writes
`.svg`/`.dxf` files next to it:

```sh
node examples/basic-usage.mjs path/to/photo.png --mm-per-px 0.1 --flip-y
```

See [`examples/README.md`](./examples/README.md) for the full option list.

### API documentation

Full generated API docs (from the TSDoc comments on the public types in
`src/types.ts`/`src/index.ts`) can be built locally:

```sh
npm run docs
```

This writes static HTML to `docs/api/` — open `docs/api/index.html` in a
browser.

## Buy Me a Coffee

If this app, code, or repository has helped you or someone you know, please consider donating. I appreciate any help to offset the costs of development and/or AI Credits.

[**Donate via Stripe**](https://donate.stripe.com/00w5kD3Gj1Xo9v7gVOcs800), or scan:

[![Donate via Stripe](./donate.svg)](https://donate.stripe.com/00w5kD3Gj1Xo9v7gVOcs800)

## License

Apache 2

## Copyright

(c)2026 Richard McQuiston.

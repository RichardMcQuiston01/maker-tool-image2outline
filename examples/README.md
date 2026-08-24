# Examples

Minimal usage examples for `@richardmcquiston/makertool-image2outline`
(PLAN.md Stage 4). Full README docs land in Stage 5 — these exist to prove
the public API is actually usable end to end.

## `basic-usage.mjs`

Traces an image and writes `.svg`/`.dxf` files alongside it.

```sh
npm run build
node examples/basic-usage.mjs path/to/photo.png
node examples/basic-usage.mjs path/to/photo.png --mm-per-px 0.1
node examples/basic-usage.mjs path/to/photo.png --mm-per-px 0.1 --flip-y
```

- `--mm-per-px N` — manual scale calibration: N millimeters per source
  pixel. Omit to keep output in pixel space.
- `--flip-y` — normalize to CAD convention (Y up, origin bottom-left).
  Most useful with `.dxf` output; SVG doesn't need it (SVG is itself
  Y-down).

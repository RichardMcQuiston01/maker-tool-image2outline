# CHANGELOG

## Unreleased

### Added (M0 — Foundation)

- TS project scaffold: `tsup` dual ESM/CJS build, strict `tsconfig`,
  ESLint (flat config) + Prettier, `vitest` test runner.
- Public API contract (`src/types.ts`, `src/index.ts`): `image2outline()`
  entry point, `Image2OutlineOptions`, `OutlineResult`, `ImageInput`,
  `OutputFormat`, `Unit`, `ScaleCalibration`. The pipeline itself is not
  implemented yet — see `PLAN.md` / `ROADMAP.md`.
- Internal vector IR (`src/ir/types.ts`): `VectorDocument`, `VectorShape`,
  `Contour`, `VectorPath`, `PathSegment`, `Winding`, `Unit`.
- Image-decode adapter interface (`src/adapters/types.ts`); a Node
  implementation lands in Stage 1.
- Test fixtures convention (`test/fixtures/`) and CI workflow
  (lint, format check, typecheck, test, build on every PR).

### Added (M1 — Core vision pipeline)

- Node image-decode adapter (`src/adapters/node.ts`, `sharp`): decodes file
  paths, byte buffers, raw `ImageLikeData`, and `file:` URLs to RGBA pixel
  data.
- Vision pipeline (`src/vision/`), pixel-space image -> IR:
  - `preprocess.ts` — grayscale, box-blur denoise, Otsu threshold,
    foreground/background orientation.
  - `components.ts` — connected-component labeling (multi-object support).
  - `trace.ts` — Moore-neighbor boundary tracing plus nested-hole
    detection, so a traced "O" keeps its inner ring.
  - `simplify.ts` — Ramer-Douglas-Peucker contour simplification. Curve
    smoothing (fitting `cubic` `PathSegment`s) is deferred; the IR already
    supports it for when that lands.
  - `pipeline.ts` — `traceImage()` composes the above into a
    `VectorDocument`. Not wired behind the public API yet — that's Stage 4.
- Unit tests per sub-step plus a decode-and-trace integration test, using
  synthetic images built in test code rather than checked-in binary
  fixtures.

### Added (M2 — Calibration & units)

- Calibration stage (`src/calibration/calibrate.ts`): a pure
  `VectorDocument -> VectorDocument` transform, tested against hand-built
  IR fixtures independent of the vision pipeline and output writers.
  - `calibrate(doc, options)` with no options returns `doc` unchanged
    (px passthrough), per the Stage 2 exit criteria.
  - `ManualScale` (`pixelsPerUnit` + target `unit`) converts pixel
    coordinates to real-world mm/in, scaling `width`/`height` and every
    point (including `cubic` control points) accordingly.
  - `flipY` option normalizes image convention (Y down, origin top-left)
    to CAD convention (Y up, origin bottom-left); flipping also inverts
    each contour's `winding`, since a Y-reflection inverts polygon
    orientation.
  - New fixture (`test/fixtures/ir/index.ts`): `pixelSquareDocument`, a
    genuine `unit: "px"` document for calibration tests (the existing
    fixtures are pre-calibrated).

### Added (M4 — Integration & validation)

- `image2outline()` (`src/index.ts`) is wired end-to-end: Node
  image-decode adapter -> vision pipeline -> calibration -> requested
  output writer(s). Previously always threw.
- `Image2OutlineOptions` gained `flipY`, alongside the existing `scale`,
  to normalize output to CAD convention (Y up, origin bottom-left) —
  mainly relevant for `.dxf` consumers, since SVG is already Y-down.
- Real-image regression corpus (`test/fixtures/images/regression/`,
  `scripts/generate-regression-fixtures.mjs`): four synthesized images
  (gradient+noise, vignette+noise, blurred ring with a hole,
  noisy-background star) standing in for camera photos/scans, since this
  sandboxed dev environment can't source real ones. Each has a
  `manifest.json` entry with exact analytically-known ground truth
  (shape/hole count, area).
- Accuracy/regression harness (`test/integration/regression.test.ts`):
  traces the corpus and checks shape/hole count and outer/hole area
  against the manifest, within tolerance.
- Minimal Node usage example (`examples/basic-usage.mjs`,
  `examples/README.md`): reads an image, calls `image2outline()`, writes
  `.svg`/`.dxf` files.
- Performance smoke test (`test/integration/performance.test.ts`):
  regression guard against a large (2000x2000px) image, budgeted with
  generous headroom over the measured ~2s baseline (decode through both
  writers).
- Decision recorded (`ROADMAP.md` M4): browser adapter deferred to
  Future/stretch — additive behind the existing `ImageDecodeAdapter`
  interface, not blocking this milestone.

### Added (M3 — Output writers)

- SVG writer (`src/writers/svg.ts`): one `<path>` per shape, outer +
  holes as subpaths under `fill-rule="evenodd"` (so holes render
  correctly regardless of contour winding), `line`/`cubic` segment
  support, unit-aware `viewBox`/`width`/`height`.
- DXF writer (`src/writers/dxf.ts`): minimal hand-rolled ASCII DXF R2000
  (`AC1015`) — `HEADER` (`$ACADVER`, `$INSUNITS`), `TABLES` (`LAYER`),
  one `LWPOLYLINE` per contour (outer and holes alike — DXF has no
  native hole concept, and for laser/CNC use a hole is just another cut
  path). `cubic` segments are flattened to straight vertices
  (`bezierSegments` option); `SPLINE` entities are deferred. Hand-rolled
  rather than a third-party dependency — see the file's header comment
  for the reasoning.
- Golden-file and round-trip tests for both writers against hand-built
  IR fixtures (`test/fixtures/ir/`), independent of the vision pipeline.
  Not wired behind the public API yet — that's Stage 4.

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

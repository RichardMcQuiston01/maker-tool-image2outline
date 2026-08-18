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

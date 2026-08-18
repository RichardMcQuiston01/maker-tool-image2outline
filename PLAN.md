# Development Plan

`@richardmcquiston/makertool-image2outline` — a framework-agnostic TypeScript
package that turns a raster image (photo, scan) into a vector outline (SVG
and/or DXF) of the object(s) in it.

This document defines _how_ the project gets built: the architecture that
makes it reusable across other projects, the stages of work, and how that
work divides across multiple agents/sessions. See `ROADMAP.md` for the
milestone/version sequencing.

## 1. Design principles

These principles exist specifically because the goal is to reuse this
package in _other_ projects, not just ship it once:

1. **Stable internal representation (IR).** All pipeline stages after image
   analysis operate on one internal vector format (paths/polylines/beziers
   with units and winding/hole info), not on SVG or DXF directly. Output
   writers are pure functions `IR -> string`. This is what lets writers,
   consumers, and tests evolve independently.
2. **Framework/runtime agnostic core.** The core pipeline must not hard-depend
   on Node-only or browser-only APIs. Platform-specific concerns (file I/O,
   image decoding) live behind small adapter interfaces, with a Node adapter
   shipped first and a browser adapter added later without touching the core.
3. **No hidden global state.** Every function takes explicit input and
   options and returns a result; nothing depends on ambient config. This is
   what makes the package safe to embed in unrelated host projects.
4. **Small, typed public surface.** One entry point, a handful of option
   types, one result type. Internal modules are free to change; the public
   API is the thing other projects will pin to, so it changes deliberately
   and is versioned accordingly (semver).
5. **Testable in isolation.** Each stage (preprocess, contour, calibrate,
   write) is independently unit-testable against fixtures, not only via
   slow end-to-end image tests.

## 2. Architecture overview

```
 input (Buffer | path | ImageData | URL)
        │
        ▼
 [Adapter: decode image]  -- platform-specific (Node/browser)
        │  raw pixel data
        ▼
 [Stage 1: Preprocess]     grayscale, denoise, threshold/binarize
        │
        ▼
 [Stage 1: Contour trace]  edge/contour extraction, hole detection
        │
        ▼
 [Stage 1: Simplify]       Douglas-Peucker simplification, optional
        │                  Bezier smoothing
        ▼
 [Stage 2: Calibrate]      pixel -> real-world units (marker/DPI/manual)
        │
        ▼
      ── Internal IR ──    (the contract everything else builds on)
        │
        ├──▶ [Stage 3: SVG writer] ──▶ SVG string
        └──▶ [Stage 3: DXF writer] ──▶ DXF string
```

The IR is the seam the whole plan is organized around: everything above it
is "vision," everything below it is "export," and they can be built,
tested, and owned independently once the IR shape is frozen in Stage 0.

## 3. Stages

### Stage 0 — Foundation & API contract

**Goal:** Freeze the public API and the internal IR before any pipeline
logic is written, so downstream stages have a stable target.

- TS project scaffold: `tsconfig`, build via `tsup` (dual ESM/CJS output),
  package.json `exports` map, lint/format config.
- Public API types: `Image2OutlineOptions`, `OutlineResult`, input union
  (`Buffer | string path | ImageData | URL`), `OutputFormat`.
- Internal IR types: path/contour representation, units, hole/winding
  metadata.
- Adapter interface for image decoding (implemented in Stage 1).
- Test runner setup (`vitest`) + fixtures directory convention.
- CI: lint, typecheck, test, build on PR.

**Exit criteria:** types compile, one smoke test running in CI, no pipeline
logic yet. This stage is a hard dependency for every other stage.

### Stage 1 — Core vision pipeline

**Goal:** Raw image in, internal IR out (in pixel units).

- Node image-decode adapter (e.g. `sharp`).
- Preprocessing: grayscale, denoise, Otsu-style threshold/binarization,
  background separation.
- Contour tracing (e.g. Suzuki–Abe / Moore-neighbor) with nested-hole
  support (an "O" must keep its inner ring).
- Simplification (Ramer–Douglas–Peucker) and optional curve smoothing.
- Multi-object support (more than one shape per image).

**Depends on:** Stage 0 (IR + adapter interface).
**Exit criteria:** given a fixture image, produces IR matching an expected
shape within tolerance; unit tests per sub-step (preprocess/trace/simplify
independently testable).

### Stage 2 — Calibration & units

**Goal:** Convert pixel-space IR into real-world units, since DXF/CAD
consumers need actual dimensions, not pixel coordinates.

- Manual scale input (DPI, or "N pixels = X mm").
- Optional reference-marker detection (known-size object/marker in frame)
  for automatic calibration.
- Coordinate normalization: origin placement, Y-axis flip for CAD
  convention, configurable output units (mm/in/px).

**Depends on:** Stage 1 (IR exists). Can start once the IR shape from
Stage 0 is frozen, in parallel with late Stage 1 work.
**Exit criteria:** IR carries real-world units; documented behavior when no
calibration input is given (defaults to px passthrough).

### Stage 3 — Output writers (parallelizable)

**Goal:** IR → SVG string, IR → DXF string. Two independent modules against
the same frozen IR — this is the clearest parallelization point in the
project.

- SVG writer: path data, `viewBox`, stroke/fill options.
- DXF writer: `LWPOLYLINE`/`SPLINE` entities, layers, units header
  (hand-rolled minimal R12/R2000 writer, or a vetted library if one fits
  the license/footprint constraints).

**Depends on:** Stage 0 IR contract (not on Stage 1/2 internals — writers
can be developed and unit-tested against hand-built IR fixtures before the
vision pipeline is finished).
**Exit criteria:** round-trip tests — IR fixture → SVG/DXF → re-parsed (or
visually/structurally checked) → matches expected geometry.

### Stage 4 — Integration, examples & validation

**Goal:** Prove the assembled pipeline works on real images, not just
fixtures.

- Wire Stages 1→2→3 behind the public API from Stage 0.
- Real-image test corpus: camera photos and scans, varied lighting/
  background/noise conditions.
- Accuracy check harness (contour fidelity vs. hand-traced ground truth,
  at least qualitatively).
- Minimal CLI and/or Node usage example; browser adapter + demo if in
  scope for this pass (see ROADMAP).
- Performance pass on large images.

**Depends on:** Stages 1–3 complete.

### Stage 5 — Documentation & release

**Goal:** Make the package actually consumable by other projects (the
stated end goal).

- Fill in README Prerequisites/Installation/Usage/Examples.
- Generated API docs (typedoc) from the Stage 0 public types.
- CHANGELOG entries, semver tagging, npm publish under the
  `@richardmcquiston` scope.

**Depends on:** Stage 4.

## 4. Multi-agent development model

The stage boundaries above are also agent-ownership boundaries. The IR and
public API from Stage 0 are the contract every other agent codes against,
so Stage 0 must land and be reviewed before parallel work starts.

| Role                     | Owns                                                                                                                                   | Can start after                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Architect**            | Stage 0 (API + IR types, adapter interface, project scaffold, CI). Also reviews other agents' PRs for contract conformance throughout. | — (first)                                                                 |
| **Vision-core agent**    | Stage 1 (preprocess, trace, simplify)                                                                                                  | Stage 0 merged                                                            |
| **Calibration agent**    | Stage 2 (units/scaling)                                                                                                                | Stage 0 merged (works against IR fixtures; doesn't need Stage 1 finished) |
| **SVG-writer agent**     | Stage 3 SVG writer                                                                                                                     | Stage 0 merged (works against IR fixtures)                                |
| **DXF-writer agent**     | Stage 3 DXF writer                                                                                                                     | Stage 0 merged (works against IR fixtures)                                |
| **QA/integration agent** | Stage 4: fixture corpus, accuracy harness, wiring, examples                                                                            | Stages 1–3 substantially complete                                         |
| **Docs/release agent**   | Stage 5                                                                                                                                | Stage 4 complete                                                          |

Key point: four of the seven roles (vision-core, calibration, SVG-writer,
DXF-writer) can run **concurrently** immediately after Stage 0, because
they all depend only on the frozen IR/API types, not on each other's
implementations. This is the practical payoff of designing the IR first —
it turns a linear pipeline into a fan-out.

**Coordination rules:**

- No agent other than the Architect changes the public API or IR shape
  without an explicit, reviewed change — every other agent treats those
  types as read-only contracts.
- Each agent's stage lands with its own tests against fixtures, so
  integration in Stage 4 is wiring + real-image validation, not first-time
  discovery of interface mismatches.
- If a downstream agent finds the IR is missing something it needs (e.g. a
  metadata field), that's a change request back to the Architect, not a
  local workaround.

In practice (this being a Claude Code project): Stage 0 is done as a single
focused session. Stages 1/2/3's independent branches are well-suited to
parallel subagents or a `Workflow` fan-out once Stage 0 is merged, each
working in its own module with its own tests, followed by a QA/integration
pass that pulls them together.

## 5. Testing & validation strategy

- **Unit tests per stage**, using fixtures (small pixel grids for vision,
  hand-built IR objects for writers) — fast, no real images required.
- **Golden-file tests** for writers: known IR → expected SVG/DXF output,
  checked byte-for-byte or structurally.
- **Real-image regression corpus** (Stage 4): a small, checked-in set of
  representative photos/scans with expected/approximate outlines, to catch
  pipeline regressions that unit tests can't.
- **CI gate**: lint + typecheck + unit tests on every PR; real-image corpus
  run at least before each release.

## 6. Risks & open questions

- **DXF library choice**: hand-rolled minimal writer vs. third-party
  dependency — affects license, bundle size, and how much of Stage 3 is
  "build" vs. "integrate." Decide at the start of Stage 3.
- **Browser support scope**: how much of Stage 1 (image decode, and any
  native/WASM-backed contour tracing) needs a browser-compatible path in
  v1, vs. Node-only first with browser as a later milestone. Affects the
  adapter interface designed in Stage 0.
- **Calibration UX**: manual scale input is simple and reliable; automatic
  marker detection is higher value but adds its own CV problem. Plan is
  manual-first (Stage 2 core), marker detection as a stretch goal.
- **Accuracy definition**: "correct outline" doesn't have an objective
  metric without ground-truth vector data. Stage 4's harness will likely
  start qualitative (visual diff) and formalize over time.

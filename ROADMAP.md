# Roadmap

Milestone-based sequencing for `@richardmcquiston/makertool-image2outline`.
No calendar dates — velocity on a solo/agent-driven project is hard to
predict — but the order and dependencies below are fixed. See `PLAN.md`
for the full architectural rationale and agent-ownership breakdown behind
each milestone.

Status legend: ⬜ not started · 🟨 in progress · ✅ done

## M0 — Foundation (`v0.1.0-alpha`) ✅

Scaffold and contracts. Nothing downstream starts until this ships.

- [x] TS project scaffold (tsconfig, `tsup` dual ESM/CJS build, lint/format)
- [x] Public API types (`Image2OutlineOptions`, `OutlineResult`, input union,
      `OutputFormat`)
- [x] Internal IR types (paths, units, hole/winding metadata)
- [x] Image-decode adapter interface (Node impl deferred to M1)
- [x] Test runner + fixtures convention (`vitest`)
- [x] CI: lint, typecheck, test, build on every PR

**Ships:** types-only package, green CI, no image processing yet.

## M1 — Core vision pipeline (`v0.2.0-alpha`) ⬜

_Depends on: M0._

- [ ] Node image-decode adapter
- [ ] Preprocessing (grayscale, denoise, threshold/binarize)
- [ ] Contour tracing with nested-hole support
- [ ] Contour simplification (Ramer–Douglas–Peucker) + optional smoothing
- [ ] Multi-object detection in a single image
- [ ] Unit tests per sub-step against fixture images

**Ships:** image → IR (pixel units), internally testable, no public export
path yet.

## M2 — Calibration & units (`v0.3.0-alpha`) ⬜

_Depends on: M0. Can run in parallel with the back half of M1._

- [ ] Manual scale input (DPI / "N px = X mm")
- [ ] Coordinate normalization (origin, CAD Y-axis convention)
- [ ] Configurable output units (mm/in/px)
- [ ] Stretch: reference-marker auto-calibration

**Ships:** IR carries real-world units.

## M3 — Output writers (`v0.4.0-alpha`) ⬜

_Depends on: M0 only — can start immediately after M0, in parallel with
M1/M2, since writers work against IR fixtures, not the live pipeline._

- [ ] SVG writer (path data, `viewBox`, style options)
- [ ] DXF writer (`LWPOLYLINE`/`SPLINE`, layers, units header)
- [ ] Golden-file tests for both writers
- [ ] Decision recorded: hand-rolled vs. third-party DXF writer

**Ships:** `IR -> SVG` and `IR -> DXF`, independently tested.

## M4 — Integration & validation (`v0.5.0-beta`) ⬜

_Depends on: M1, M2, M3 complete._

- [ ] Wire pipeline end-to-end behind the public API
- [ ] Real-image regression corpus (camera photos + scans, varied
      lighting/background/noise) checked into the repo
- [ ] Accuracy/regression check harness
- [ ] Minimal CLI or Node usage example
- [ ] Performance pass on large images
- [ ] Decision made: browser adapter in this pass, or deferred (see Future)

**Ships:** first version that works end-to-end on real, non-fixture
images.

## M5 — Docs & release (`v1.0.0`) ⬜

_Depends on: M4._

- [ ] README Prerequisites/Installation/Usage/Examples filled in
- [ ] Generated API docs (typedoc)
- [ ] CHANGELOG populated, semver applied retroactively to prior tags
- [ ] Published to npm under `@richardmcquiston` scope

**Ships:** `v1.0.0`, the first version intended for reuse in other
projects (the stated goal of this package).

## Future / stretch (post-`v1.0.0`) ⬜

Not scheduled into a milestone yet; revisit after v1.0 usage in a real
consuming project surfaces actual needs.

- Browser adapter + in-browser demo (if not pulled into M4)
- Automatic reference-marker calibration (if not pulled into M2)
- Batch/multi-image processing API
- ML-assisted segmentation for complex/low-contrast backgrounds
- Simple GUI/preview tool built on top of the package
- WASM-accelerated contour tracing for large images

## Working agreement

- A milestone doesn't start (beyond the parallel-eligible ones noted above)
  until its dependencies are merged.
- Public API/IR changes after M0 go through the same review process
  described in `PLAN.md` §4 — no silent breaking changes once other
  modules depend on the contract.
- Update the status checkboxes/legend in this file as work lands, and add
  an entry to `CHANGELOG.md` for every milestone release.

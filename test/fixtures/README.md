# Fixtures

Convention for test fixtures (PLAN.md §5, "unit tests per stage, using
fixtures"):

- `test/fixtures/ir/` — hand-built `VectorDocument`/`Contour`/`VectorPath`
  objects (as `.ts` or `.json`) used to unit-test output writers (Stage 3)
  independently of the vision pipeline.
- `test/fixtures/images/` — small source images (synthetic or real) used
  to unit-test preprocessing/contour-tracing (Stage 1). Keep these small;
  the larger real-world regression corpus described in PLAN.md Stage 4
  lives separately once that stage starts.
- Co-locate each fixture with a short comment on what it's meant to
  exercise (e.g. "single closed shape, no holes" vs. "nested hole").

This directory is intentionally empty until Stage 1/Stage 3 work adds
fixtures against it — Stage 0 only establishes the convention.

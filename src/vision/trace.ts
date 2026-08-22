/**
 * Boundary tracing (PLAN.md Stage 1): Moore-neighbor contour tracing plus
 * nested-hole detection, so a traced "O" keeps its inner ring.
 */

import { findConnectedRegions } from "./components.js";
import type { PixelPoint, PixelRegion } from "./types.js";
import type { Winding } from "../ir/types.js";

/** 8-neighbor offsets in clockwise order, starting at North. */
const OFFSETS: readonly PixelPoint[] = [
  { x: 0, y: -1 }, // N
  { x: 1, y: -1 }, // NE
  { x: 1, y: 0 }, // E
  { x: 1, y: 1 }, // SE
  { x: 0, y: 1 }, // S
  { x: -1, y: 1 }, // SW
  { x: -1, y: 0 }, // W
  { x: -1, y: -1 }, // NW
];

const MAX_TRACE_STEPS = 1_000_000;

interface TraceState {
  readonly x: number;
  readonly y: number;
  /** Index into OFFSETS: the direction we just arrived from. */
  readonly backtrackDir: number;
}

/**
 * Moore-neighbor boundary tracing (Gonzalez & Woods): walks the
 * 8-connected boundary of the region `inside` membership-tests, starting
 * at `start`, and stops the first time it returns to `start`'s position —
 * i.e. after exactly one full lap. That's correct for simple (non
 * self-touching) silhouettes, which is what Stage 1 targets; a shape
 * that's pinched down to a single pixel could in principle need the
 * fuller position+direction stopping criterion, but isn't expected from
 * ordinary photographed/scanned objects.
 *
 * `start` must be the topmost, then leftmost, member pixel of its region
 * (as produced by `findConnectedRegions`): the initial backtrack direction
 * assumes the pixel immediately to the west is non-member, which raster
 * scan order guarantees.
 */
export function traceBoundary(
  inside: (x: number, y: number) => boolean,
  start: PixelPoint,
): PixelPoint[] {
  if (!OFFSETS.some((d) => inside(start.x + d.x, start.y + d.y))) {
    return [start]; // isolated single-pixel region
  }

  const boundary: PixelPoint[] = [start];
  let state: TraceState = { x: start.x, y: start.y, backtrackDir: 6 }; // west

  for (let step = 0; step < MAX_TRACE_STEPS; step++) {
    let foundDir = -1;
    for (let i = 1; i <= 8; i++) {
      const dir = (state.backtrackDir + i) % 8;
      const d = OFFSETS[dir]!;
      if (inside(state.x + d.x, state.y + d.y)) {
        foundDir = dir;
        break;
      }
    }
    if (foundDir === -1) break; // shouldn't happen once we've confirmed a neighbor exists

    const d = OFFSETS[foundDir]!;
    const next: TraceState = {
      x: state.x + d.x,
      y: state.y + d.y,
      backtrackDir: (foundDir + 4) % 8,
    };

    if (next.x === start.x && next.y === start.y) break; // completed the lap

    boundary.push({ x: next.x, y: next.y });
    state = next;
  }

  return boundary;
}

/** Polygon winding via the shoelace formula. */
export function polygonWinding(points: readonly PixelPoint[]): Winding {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  // Image coordinates are x-right, y-down; pinned against a hand-traced
  // square in trace.test.ts so this can't silently flip.
  return sum < 0 ? "clockwise" : "counterclockwise";
}

export interface TracedShape {
  readonly outer: readonly PixelPoint[];
  readonly holes: readonly (readonly PixelPoint[])[];
}

/**
 * Traces one component's outer boundary plus any enclosed holes.
 *
 * Holes are found by flood-filling the component's own local background
 * (its bounding box, padded by one pixel) starting from that padded
 * border — which is guaranteed non-member since the bbox tightly bounds
 * the component — with 4-connectivity. Whatever background isn't
 * reachable from the border is enclosed *by this component specifically*
 * (other components' pixels don't block or extend this component's own
 * membership test, so a shape floating inside the hole doesn't change
 * the hole's boundary — it's simply traced as its own separate shape).
 */
export function traceComponent(width: number, height: number, component: PixelRegion): TracedShape {
  const inComponent = (x: number, y: number): boolean =>
    x >= 0 && x < width && y >= 0 && y < height && component.cells.has(y * width + x);

  const outer = traceBoundary(inComponent, component.startPoint);

  const { minX, minY, maxX, maxY } = component.bbox;
  const originX = minX - 1;
  const originY = minY - 1;
  const regionWidth = maxX - minX + 3;
  const regionHeight = maxY - minY + 3;

  const isBackgroundOrOutside = (localIndex: number): boolean => {
    const lx = localIndex % regionWidth;
    const ly = (localIndex - lx) / regionWidth;
    const x = lx + originX;
    const y = ly + originY;
    if (x < 0 || x >= width || y < 0 || y >= height) return true; // outside the image: unbounded "outside"
    return !component.cells.has(y * width + x);
  };

  const isOnPaddedBorder = (localIndex: number): boolean => {
    const lx = localIndex % regionWidth;
    const ly = (localIndex - lx) / regionWidth;
    return lx === 0 || ly === 0 || lx === regionWidth - 1 || ly === regionHeight - 1;
  };

  const backgroundRegions = findConnectedRegions(
    regionWidth,
    regionHeight,
    isBackgroundOrOutside,
    4,
  );
  const holeRegions = backgroundRegions.filter(
    (region) => ![...region.cells].some((idx) => isOnPaddedBorder(idx)),
  );

  const holes = holeRegions.map((region) => {
    const inHole = (x: number, y: number): boolean => {
      const lx = x - originX;
      const ly = y - originY;
      if (lx < 0 || lx >= regionWidth || ly < 0 || ly >= regionHeight) return false;
      return region.cells.has(ly * regionWidth + lx);
    };
    const start: PixelPoint = {
      x: region.startPoint.x + originX,
      y: region.startPoint.y + originY,
    };
    return traceBoundary(inHole, start);
  });

  return { outer, holes };
}

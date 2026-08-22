/**
 * Connected-component labeling (PLAN.md Stage 1, "multi-object support").
 *
 * `findConnectedRegions` is the shared flood-fill primitive: `components.ts`
 * uses it with 8-connectivity over the foreground mask to find one region
 * per detected object; `trace.ts` reuses it with 4-connectivity over each
 * object's local background to find enclosed holes. Keeping one
 * implementation means both use the same raster-scan / start-point
 * convention that `traceBoundary` (Moore-neighbor tracing) depends on.
 */

import type { BBox, BinaryMask, PixelPoint, PixelRegion } from "./types.js";

const NEIGHBORS_8: readonly PixelPoint[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

const NEIGHBORS_4: readonly PixelPoint[] = [
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
];

/**
 * Flood-fills connected regions of pixels satisfying `isMember`, scanning
 * in raster order (row-major, left-to-right). Each region's `startPoint`
 * is its topmost, then leftmost, member pixel — the canonical
 * boundary-tracing start point `traceBoundary` expects (its initial
 * backtrack direction assumes the start pixel was reached via this exact
 * scan order).
 */
export function findConnectedRegions(
  width: number,
  height: number,
  isMember: (index: number) => boolean,
  connectivity: 4 | 8,
): PixelRegion[] {
  const neighbors = connectivity === 8 ? NEIGHBORS_8 : NEIGHBORS_4;
  const visited = new Uint8Array(width * height);
  const regions: PixelRegion[] = [];

  for (let start = 0; start < width * height; start++) {
    if (visited[start] === 1 || !isMember(start)) continue;

    const cells = new Set<number>();
    const startX = start % width;
    const startY = (start - startX) / width;
    let bbox: BBox = { minX: startX, minY: startY, maxX: startX, maxY: startY };

    const stack: number[] = [start];
    visited[start] = 1;
    while (stack.length > 0) {
      const idx = stack.pop()!;
      cells.add(idx);
      const x = idx % width;
      const y = (idx - x) / width;
      bbox = {
        minX: Math.min(bbox.minX, x),
        minY: Math.min(bbox.minY, y),
        maxX: Math.max(bbox.maxX, x),
        maxY: Math.max(bbox.maxY, y),
      };

      for (const d of neighbors) {
        const nx = x + d.x;
        const ny = y + d.y;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const nIdx = ny * width + nx;
        if (visited[nIdx] === 0 && isMember(nIdx)) {
          visited[nIdx] = 1;
          stack.push(nIdx);
        }
      }
    }

    regions.push({ cells, startPoint: { x: startX, y: startY }, bbox });
  }

  return regions;
}

/** One region per detected object (8-connected foreground blob). */
export function labelComponents(mask: BinaryMask): PixelRegion[] {
  return findConnectedRegions(mask.width, mask.height, (i) => mask.data[i] === 1, 8);
}

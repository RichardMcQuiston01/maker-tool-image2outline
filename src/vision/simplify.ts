/**
 * Ramer-Douglas-Peucker simplification (PLAN.md Stage 1), used to reduce a
 * dense one-point-per-pixel boundary trace down to a compact polyline
 * within a given tolerance.
 */

import type { PixelPoint } from "./types.js";

function perpendicularDistance(
  point: PixelPoint,
  lineStart: PixelPoint,
  lineEnd: PixelPoint,
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    const ddx = point.x - lineStart.x;
    const ddy = point.y - lineStart.y;
    return Math.sqrt(ddx * ddx + ddy * ddy);
  }

  const numerator = Math.abs(
    dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x,
  );
  return numerator / Math.sqrt(lengthSquared);
}

/**
 * Standard recursive RDP over an open polyline: `points[0]` and the last
 * point are always kept; interior points are dropped when they lie within
 * `epsilon` of the line between their neighbors.
 */
export function simplifyPath(points: readonly PixelPoint[], epsilon: number): PixelPoint[] {
  if (points.length < 3 || epsilon <= 0) return [...points];

  const first = points[0]!;
  const last = points[points.length - 1]!;
  let maxDistance = 0;
  let maxIndex = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i]!, first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  if (maxDistance > epsilon) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), epsilon);
    const right = simplifyPath(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

/**
 * RDP over a closed loop (e.g. a traced contour): the closing edge (last
 * point back to the first) is included in the simplification pass so a
 * straight edge spanning the array boundary still collapses correctly.
 */
export function simplifyClosedPath(points: readonly PixelPoint[], epsilon: number): PixelPoint[] {
  if (points.length < 3) return [...points];

  const withClosingPoint = [...points, points[0]!];
  const simplified = simplifyPath(withClosingPoint, epsilon);
  return simplified.slice(0, -1);
}

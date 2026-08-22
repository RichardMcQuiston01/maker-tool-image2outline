/**
 * Stage 1 vision pipeline (PLAN.md Stage 1): decoded image in, internal IR
 * out, in pixel units. Calibration to real-world units is Stage 2; this
 * module never runs on its own behind the public API yet (see
 * ROADMAP.md M1 — that wiring is Stage 4).
 */

import type { DecodedImage } from "../adapters/types.js";
import type {
  HoleContour,
  OuterContour,
  PathSegment,
  VectorDocument,
  VectorPath,
  VectorShape,
} from "../ir/types.js";
import { labelComponents } from "./components.js";
import { preprocess, type PreprocessOptions } from "./preprocess.js";
import { simplifyClosedPath } from "./simplify.js";
import { polygonWinding, traceComponent } from "./trace.js";
import type { PixelPoint } from "./types.js";

export interface VisionPipelineOptions extends PreprocessOptions {
  /** Ramer-Douglas-Peucker simplification tolerance, in pixels. 0 disables it. */
  readonly simplifyEpsilon?: number;
}

const DEFAULT_SIMPLIFY_EPSILON = 1.5;

/** Traces every object in `image`, producing a pixel-space `VectorDocument`. */
export function traceImage(
  image: DecodedImage,
  options: VisionPipelineOptions = {},
): VectorDocument {
  const { simplifyEpsilon = DEFAULT_SIMPLIFY_EPSILON, ...preprocessOptions } = options;
  const mask = preprocess(image, preprocessOptions);
  const components = labelComponents(mask);

  const shapes: VectorShape[] = components.map((component, index) => {
    const traced = traceComponent(mask.width, mask.height, component);
    return {
      id: `shape-${index}`,
      outer: buildOuterContour(traced.outer, simplifyEpsilon),
      holes: traced.holes.map((hole) => buildHoleContour(hole, simplifyEpsilon)),
    };
  });

  return { unit: "px", width: image.width, height: image.height, shapes };
}

function buildPath(points: readonly PixelPoint[], epsilon: number): VectorPath {
  const simplified = simplifyClosedPath(points, epsilon);
  const [start, ...rest] = simplified;
  const segments: PathSegment[] = rest.map((p) => ({ type: "line", to: { x: p.x, y: p.y } }));
  return { start: { x: start!.x, y: start!.y }, segments, closed: true };
}

function buildOuterContour(points: readonly PixelPoint[], epsilon: number): OuterContour {
  return { path: buildPath(points, epsilon), winding: polygonWinding(points), isHole: false };
}

function buildHoleContour(points: readonly PixelPoint[], epsilon: number): HoleContour {
  return { path: buildPath(points, epsilon), winding: polygonWinding(points), isHole: true };
}

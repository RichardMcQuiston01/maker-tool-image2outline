/**
 * Minimal parser for the exact SVG path `d` subset `writeSvg` emits
 * (`M x,y`, `L x,y`, `C c1x,c1y c2x,c2y x,y`, `Z`), used only to round-trip
 * test writer output against the source IR — not a general SVG parser.
 */

import type { PathSegment, Point } from "../../src/ir/types.js";

export interface ParsedSubpath {
  readonly start: Point;
  readonly segments: readonly PathSegment[];
  readonly closed: boolean;
}

function parsePoint(token: string): Point {
  const [x, y] = token.split(",").map(Number);
  return { x: x!, y: y! };
}

export function parsePathD(d: string): ParsedSubpath[] {
  const tokens = d.trim().split(/\s+/);
  const subpaths: ParsedSubpath[] = [];
  let i = 0;

  while (i < tokens.length) {
    if (tokens[i] !== "M") throw new Error(`expected "M" at token ${i}, got "${tokens[i]}"`);
    const start = parsePoint(tokens[i + 1]!);
    i += 2;

    const segments: PathSegment[] = [];
    let closed = false;
    while (i < tokens.length && tokens[i] !== "M") {
      const command = tokens[i];
      if (command === "L") {
        segments.push({ type: "line", to: parsePoint(tokens[i + 1]!) });
        i += 2;
      } else if (command === "C") {
        segments.push({
          type: "cubic",
          control1: parsePoint(tokens[i + 1]!),
          control2: parsePoint(tokens[i + 2]!),
          to: parsePoint(tokens[i + 3]!),
        });
        i += 4;
      } else if (command === "Z") {
        closed = true;
        i += 1;
      } else {
        throw new Error(`unexpected path command "${command}" at token ${i}`);
      }
    }

    subpaths.push({ start, segments, closed });
  }

  return subpaths;
}

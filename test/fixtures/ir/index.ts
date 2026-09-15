/**
 * Hand-built `VectorDocument` fixtures (test/fixtures/README.md convention)
 * used to unit-test the Stage 3 output writers independently of the
 * vision pipeline that would otherwise produce these documents.
 */

import type { VectorDocument } from "../../../src/ir/types.js";

const squareOuter = {
  isHole: false as const,
  winding: "clockwise" as const,
  path: {
    start: { x: 0, y: 0 },
    closed: true,
    segments: [
      { type: "line" as const, to: { x: 10, y: 0 } },
      { type: "line" as const, to: { x: 10, y: 10 } },
      { type: "line" as const, to: { x: 0, y: 10 } },
    ],
  },
};

/** A single 10x10 mm square, no holes. */
export const squareDocument: VectorDocument = {
  unit: "mm",
  width: 10,
  height: 10,
  shapes: [{ id: "square", outer: squareOuter, holes: [] }],
};

/** A 10x10 mm square with a 2x2 mm square hole centered inside it (the "O" case). */
export const squareWithHoleDocument: VectorDocument = {
  unit: "mm",
  width: 10,
  height: 10,
  shapes: [
    {
      id: "ring",
      outer: squareOuter,
      holes: [
        {
          isHole: true,
          winding: "counterclockwise",
          path: {
            start: { x: 4, y: 4 },
            closed: true,
            segments: [
              { type: "line", to: { x: 6, y: 4 } },
              { type: "line", to: { x: 6, y: 6 } },
              { type: "line", to: { x: 4, y: 6 } },
            ],
          },
        },
      ],
    },
  ],
};

/** Two disjoint square shapes in one document, for multi-shape output tests. */
export const twoSquaresDocument: VectorDocument = {
  unit: "px",
  width: 30,
  height: 10,
  shapes: [
    { id: "left", outer: squareOuter, holes: [] },
    {
      id: "right",
      outer: {
        isHole: false,
        winding: "clockwise",
        path: {
          start: { x: 20, y: 0 },
          closed: true,
          segments: [
            { type: "line", to: { x: 30, y: 0 } },
            { type: "line", to: { x: 30, y: 10 } },
            { type: "line", to: { x: 20, y: 10 } },
          ],
        },
      },
      holes: [],
    },
  ],
};

/** A 100x100 px square, no holes — genuine pixel-space (uncalibrated) input, for calibration tests. */
export const pixelSquareDocument: VectorDocument = {
  unit: "px",
  width: 100,
  height: 100,
  shapes: [
    {
      id: "square",
      outer: {
        isHole: false,
        winding: "clockwise",
        path: {
          start: { x: 0, y: 0 },
          closed: true,
          segments: [
            { type: "line", to: { x: 100, y: 0 } },
            { type: "line", to: { x: 100, y: 100 } },
            { type: "line", to: { x: 0, y: 100 } },
          ],
        },
      },
      holes: [],
    },
  ],
};

const pentagonObject = {
  isHole: false as const,
  winding: "clockwise" as const,
  path: {
    start: { x: 50, y: 50 },
    closed: true,
    segments: [
      { type: "line" as const, to: { x: 60, y: 45 } },
      { type: "line" as const, to: { x: 70, y: 55 } },
      { type: "line" as const, to: { x: 65, y: 70 } },
      { type: "line" as const, to: { x: 52, y: 68 } },
    ],
  },
};

/** An irregular (non-square) 5-vertex shape, for reference-marker "no marker found" tests. */
export const pentagonDocument: VectorDocument = {
  unit: "px",
  width: 100,
  height: 100,
  shapes: [{ id: "object", outer: pentagonObject, holes: [] }],
};

/** A 20x20 px axis-aligned square marker plus an unrelated pentagon "object" shape. */
export const squareMarkerWithObjectDocument: VectorDocument = {
  unit: "px",
  width: 100,
  height: 100,
  shapes: [
    {
      id: "marker",
      outer: {
        isHole: false,
        winding: "clockwise",
        path: {
          start: { x: 0, y: 0 },
          closed: true,
          segments: [
            { type: "line", to: { x: 20, y: 0 } },
            { type: "line", to: { x: 20, y: 20 } },
            { type: "line", to: { x: 0, y: 20 } },
          ],
        },
      },
      holes: [],
    },
    { id: "object", outer: pentagonObject, holes: [] },
  ],
};

/**
 * A square marker rotated 45 degrees (a "diamond") plus an unrelated
 * pentagon object — confirms marker detection works from the polygon's own
 * edge/diagonal geometry, not an axis-aligned bounding box.
 */
export const rotatedSquareMarkerWithObjectDocument: VectorDocument = {
  unit: "px",
  width: 100,
  height: 100,
  shapes: [
    {
      id: "marker",
      outer: {
        isHole: false,
        winding: "clockwise",
        path: {
          start: { x: 10, y: 0 },
          closed: true,
          segments: [
            { type: "line", to: { x: 20, y: 10 } },
            { type: "line", to: { x: 10, y: 20 } },
            { type: "line", to: { x: 0, y: 10 } },
          ],
        },
      },
      holes: [],
    },
    { id: "object", outer: pentagonObject, holes: [] },
  ],
};

/** Two square-like shapes and no other objects — the "ambiguous marker" case. */
export const twoSquareMarkersDocument: VectorDocument = {
  unit: "px",
  width: 100,
  height: 100,
  shapes: [
    {
      id: "left",
      outer: {
        isHole: false,
        winding: "clockwise",
        path: {
          start: { x: 0, y: 0 },
          closed: true,
          segments: [
            { type: "line", to: { x: 20, y: 0 } },
            { type: "line", to: { x: 20, y: 20 } },
            { type: "line", to: { x: 0, y: 20 } },
          ],
        },
      },
      holes: [],
    },
    {
      id: "right",
      outer: {
        isHole: false,
        winding: "clockwise",
        path: {
          start: { x: 50, y: 50 },
          closed: true,
          segments: [
            { type: "line", to: { x: 70, y: 50 } },
            { type: "line", to: { x: 70, y: 70 } },
            { type: "line", to: { x: 50, y: 70 } },
          ],
        },
      },
      holes: [],
    },
  ],
};

/** A shape with one cubic bezier segment, to exercise curve handling in both writers. */
export const curvedDocument: VectorDocument = {
  unit: "px",
  width: 10,
  height: 10,
  shapes: [
    {
      id: "curve",
      outer: {
        isHole: false,
        winding: "clockwise",
        path: {
          start: { x: 0, y: 0 },
          closed: true,
          segments: [
            {
              type: "cubic",
              control1: { x: 0, y: 10 },
              control2: { x: 10, y: 10 },
              to: { x: 10, y: 0 },
            },
          ],
        },
      },
      holes: [],
    },
  ],
};

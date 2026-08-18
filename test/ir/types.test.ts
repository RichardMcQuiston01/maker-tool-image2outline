import { describe, expect, it } from "vitest";

import type { VectorDocument } from "../../src/ir/types.js";

describe("internal IR shape (Stage 0 contract)", () => {
  it("supports a closed outer contour with a nested hole", () => {
    // A minimal traced "O": one shape, one outer contour, one hole.
    const doc: VectorDocument = {
      unit: "px",
      width: 100,
      height: 100,
      shapes: [
        {
          id: "shape-0",
          outer: {
            winding: "clockwise",
            isHole: false,
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
          holes: [
            {
              winding: "counterclockwise",
              isHole: true,
              path: {
                start: { x: 25, y: 25 },
                closed: true,
                segments: [
                  {
                    type: "cubic",
                    control1: { x: 75, y: 25 },
                    control2: { x: 75, y: 75 },
                    to: { x: 25, y: 75 },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    expect(doc.shapes).toHaveLength(1);
    expect(doc.shapes[0]?.holes).toHaveLength(1);
    expect(doc.shapes[0]?.outer.path.closed).toBe(true);
  });
});

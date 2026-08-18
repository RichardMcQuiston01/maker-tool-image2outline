import { describe, expect, it } from "vitest";

import { image2outline } from "../src/index.js";
import type { Image2OutlineOptions } from "../src/index.js";

describe("image2outline (Stage 0 stub)", () => {
  it("is exported with the frozen public signature", () => {
    expect(typeof image2outline).toBe("function");
  });

  it("rejects until the pipeline lands in a later stage", async () => {
    const options: Image2OutlineOptions = { formats: ["svg"] };
    await expect(image2outline("fixture.png", options)).rejects.toThrow(/not implemented/i);
  });
});

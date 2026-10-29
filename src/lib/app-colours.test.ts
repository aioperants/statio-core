import { describe, expect, it } from "vitest";
import { NEUTRAL, websiteColours } from "./app-colours";
import { contrast, luminance } from "./site/theme";

describe("app colours", () => {
  it("are black and white by default", () => {
    expect(contrast(NEUTRAL.brand, "#FFFFFF")).toBeGreaterThan(15);
    expect(luminance(NEUTRAL.canvas)).toBeGreaterThan(0.9);
  });

  it("take the salon's own colour with the brand palette", () => {
    expect(websiteColours("minimalist", "#2F6B5E", "brand").brand).toBe("#2F6B5E");
  });

  it("keep white text readable on buttons and the page light, even with light or dark looks", () => {
    for (const [d, p, c] of [["minimalist", "brand", "#FFE600"], ["minimalist", "snow", "#000000"]] as const) {
      const x = websiteColours(d, c, p);
      expect(contrast(x.brand, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
      expect(luminance(x.canvas)).toBeGreaterThan(0.8);
    }
  });
});

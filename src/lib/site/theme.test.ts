import { describe, expect, it } from "vitest";
import { DIRECTIONS, POPULAR, PRESETS, defaultConfig } from "./config";
import { contrast, palettesOf, themeFor } from "./theme";

// Brand colours owners really pick, including the hard ones: pale yellow, white, black, mid grey, neon.
const BRANDS = ["#7A2E5A", "#FFE600", "#FFFFFF", "#000000", "#808080", "#39FF14", "#F4C2C2", "#1D3557", "#E63946", "#C9A227"];

describe("every design direction stays readable with any brand colour (WCAG AA)", () => {
  for (const d of DIRECTIONS) {
    for (const brand of BRANDS) {
      it(`${d} with ${brand}`, () => {
        const t = themeFor(d, brand);
        for (const bg of [t.bg, t.surface, t.tint]) {
          expect(contrast(t.text, bg)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(t.muted, bg)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(t.accent, bg)).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(t.buttonText, t.button)).toBeGreaterThanOrEqual(4.5);
        // A button close to the page colour gets an outline that stands out (non-text contrast, 3:1).
        expect(contrast(t.buttonBorder, t.bg)).toBeGreaterThanOrEqual(3);
      });
    }
  }

  for (const d of DIRECTIONS) {
    for (const p of palettesOf(d).filter((x) => x !== "brand")) {
      it(`${d} in the ${p} palette`, () => {
        const t = themeFor(d, "#FFE600", p);
        for (const bg of [t.bg, t.surface, t.tint]) {
          expect(contrast(t.text, bg)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(t.muted, bg)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(t.accent, bg)).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(t.buttonText, t.button)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.buttonBorder, t.bg)).toBeGreaterThanOrEqual(3);
        // A palette uses its own accent, not the salon's brand colour.
        expect(t.brand).not.toBe("#FFE600");
      });
    }
  }

  it("contrast is computed like WCAG", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1);
  });
});

describe("each archetype's popular looks and colours", () => {
  it("only name colours that exist for that look, and a new website starts on the first", () => {
    for (const p of PRESETS) {
      expect(POPULAR[p].length).toBeGreaterThan(0);
      for (const x of POPULAR[p]) expect(palettesOf(x.direction)).toContain(x.palette);
      expect(defaultConfig(p)).toMatchObject(POPULAR[p][0]);
    }
  });
});

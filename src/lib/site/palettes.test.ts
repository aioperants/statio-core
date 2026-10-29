import { describe, expect, it } from "vitest";
import { DIRECTIONS } from "./config";
import { ALL_PALETTES, palettesOf, themeFor } from "./theme";

describe("colour sets", () => {
  it("look the same with every look: page, panels and buttons are the set's own", () => {
    for (const d of DIRECTIONS)
      for (const [name, p] of Object.entries(ALL_PALETTES)) {
        const th = themeFor(d, "#123456", name);
        expect([th.bg, th.surface, th.button], `${d} · ${name}`).toEqual([p.bg, p.surface, p.accent.toUpperCase()]);
      }
  });
  it("are all offered with every look", () => {
    for (const d of DIRECTIONS) expect(palettesOf(d)).toEqual(expect.arrayContaining(["brand", ...Object.keys(ALL_PALETTES)]));
  });
  it("include a plain black and white one, whatever the look", () => {
    for (const d of DIRECTIONS) {
      const th = themeFor(d, "#2E5E45", "snow");
      expect(th.bg).toBe("#FFFFFF");
      expect(th.button).toBe("#141414");
    }
  });
});

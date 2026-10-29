import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import { defaultConfig, LAYOUTS, PIECES, presetFor, readConfig } from "./config";

describe("the name at the top", () => {
  it("shows by default, and stays off when the owner turned it off", () => {
    expect(defaultConfig("hair").heroName).toBe(true);
    expect(readConfig({ ...defaultConfig("hair") }).heroName).toBe(true);
    expect(readConfig({ ...defaultConfig("hair"), heroName: undefined }).heroName).toBe(true);
    expect(readConfig({ ...defaultConfig("hair"), heroName: false }).heroName).toBe(false);
  });
});

describe("laser hair removal", () => {
  it("gets its own website kind, unless the salon also does beauty or spa", () => {
    expect(presetFor(["laser"])).toBe("laser");
    expect(presetFor(["beauty", "laser"])).toBe("aesthetics");
    expect(presetFor(["spa", "laser"])).toBe("spa");
  });
  it("has suggested questions in the clients' languages", () => {
    for (const m of [en, es]) expect(m.siteDrafts.faq.laser.length).toBeGreaterThan(1);
    expect(en.admin.website.presets.laser.name).toBeTruthy();
  });
});

describe("the website", () => {
  it("has fixed sections in a fixed order and one look, whatever was stored", () => {
    const stored = {
      ...defaultConfig("nails"),
      direction: "elegant",
      palette: "gold",
      brandColor: "#aa3366",
      about: "Since 2010.",
      pieces: [
        { key: "contact", on: true, layout: "buttons" },
        { key: "offers", on: true, layout: "cards" },
        { key: "gallery", on: false, layout: "mosaic" },
      ],
    };
    const c = readConfig(stored);
    expect([c.direction, c.palette, c.brandColor, c.about]).toEqual(["minimalist", "snow", null, "Since 2010."]);
    expect(c.pieces.map((p) => p.key)).toEqual([...PIECES]);
    // What the owner switched off stays off; a design Core doesn't have falls back to the section's one design.
    expect(c.pieces.find((p) => p.key === "gallery")).toEqual({ key: "gallery", on: false, layout: LAYOUTS.gallery[0] });
  });
});

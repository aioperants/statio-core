import { describe, expect, it } from "vitest";
import { defaultConfig, type PieceKey } from "./config";
import { menuLinks } from "./menu";

describe("the website's menu", () => {
  const config = defaultConfig("hair");
  const keys = (shown: PieceKey[]) => menuLinks(config.pieces, (k) => shown.includes(k));

  it("lists only the sections the page shows, in page order, never the top", () => {
    const links = keys(["hero", "services", "team", "hours", "contact", "faq"]);
    expect(links.map((l) => l.key)).toEqual(["services", "team", "faq", "hours", "contact"]);
    expect(links.find((l) => l.key === "services")?.href).toBe("#piece-services");
  });

  it("leaves out hidden sections, even with something to show", () => {
    const hidden = config.pieces.map((p) => (p.key === "team" ? { ...p, on: false } : p));
    expect(menuLinks(hidden, () => true).some((l) => l.key === "team")).toBe(false);
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { createTranslator } from "use-intl/core";
import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import { LAYOUTS, PIECES, PRESETS, defaultConfig, readConfig, type SiteConfig } from "@/lib/site/config";
import { emptySalon, fullSalon, smallSalon } from "@/lib/site/fixtures";
import type { SiteData } from "@/lib/site/types";
import { Site, type SiteT } from "./site";

const tFor = (locale: "en" | "es") => createTranslator({ locale, messages: locale === "es" ? es : en, namespace: "site" }) as unknown as SiteT;
const render = (config: SiteConfig, data: SiteData) => renderToStaticMarkup(<Site config={config} data={data} t={tFor("es")} />);
const ownTexts = (c: SiteConfig): SiteConfig => ({ ...c, about: "Somos un salón de barrio.\n\nDesde 1998.", faq: [{ q: "¿Hay aparcamiento?", a: "Sí, en la calle." }], gallery: [{ id: "11111111-2222-3333-4444-555555555555", caption: "Mechas balayage" }] });
const withTop = (layout: string) => ({ ...defaultConfig("barbershop"), pieces: defaultConfig("barbershop").pieces.map((p) => (p.key === "hero" ? { ...p, on: true, layout } : p)) });

const SALONS = { empty: emptySalon, small: smallSalon, full: fullSalon };

describe("every kind of salon renders, empty, small and full", () => {
  for (const preset of PRESETS) {
    for (const [size, data] of Object.entries(SALONS)) {
      it(`${preset} · ${size}`, () => {
        const config = defaultConfig(preset);
        const html = render(size === "full" ? ownTexts(config) : config, data);
        expect(html).toContain(data.name);
        expect(html).toContain('href="/es/book"');
        expect(html).not.toMatch(/undefined|NaN|\[object|null/);
        // Only sections with something to show.
        if (size === "empty") for (const id of ["services", "team", "about", "faq", "contact"]) expect(html).not.toContain(`id="${id}"`);
        if (size === "small") expect(html).not.toContain('id="team"'); // one person: no team section
        if (size === "full") expect(html).toContain("Corte caballero");
      });
    }
  }
});

describe("every section renders in each of its designs", () => {
  for (const key of PIECES) {
    for (const layout of LAYOUTS[key]) {
      it(`${key} · ${layout}`, () => {
        const base = ownTexts(defaultConfig("hair"));
        const config = { ...base, pieces: base.pieces.map((p) => ({ ...p, on: p.key === key || p.key === "hero", layout: p.key === key ? layout : p.layout })) };
        const html = render(config, fullSalon);
        expect(html).not.toMatch(/undefined|NaN|\[object/);
        if (key !== "hero") expect(html).toMatch(new RegExp(`id="${key}`));
      });
    }
  }
});

describe("nothing is made up", () => {
  it("the photo top without a photo shows the name and services, never an empty image", () => {
    const html = render(withTop("photo"), { ...fullSalon, heroImage: null });
    const hero = html.slice(html.indexOf('id="piece-hero"'), html.indexOf("</section>", html.indexOf('id="piece-hero"')));
    expect(hero).toContain("s-marquee");
    expect(hero).not.toContain("<img");
  });

  it("the top bar carries only the salon's name, in the look's lettering, never the logo", () => {
    const html = render(withTop("photo"), { ...fullSalon, logo: "data:image/png;base64,AAAA" });
    const header = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
    expect(header).toContain(`<span class="s-h truncate text-xl">${fullSalon.name}</span>`);
    expect(html).not.toContain("data:image/png;base64,AAAA");
  });

  it("a new website starts with the marquee top: the name and the services running across", () => {
    const config = defaultConfig("hair");
    expect(config.pieces.find((p) => p.key === "hero")?.layout).toBe("marquee");
    const html = render(config, { ...fullSalon, heroImage: null, logo: null });
    const hero = html.slice(html.indexOf('id="piece-hero"'), html.indexOf("</section>", html.indexOf('id="piece-hero"')));
    expect(hero).toContain("s-marquee");
    // The moving copies are hidden from screen readers, who read each service once (the still list).
    expect(hero).toMatch(/s-marquee-track[^>]*aria-hidden="true"/);
    expect(hero).toContain('<ul class="s-marquee-still">');
  });

  it("the editor draws empty sections as spots to tap; the live site leaves them out", () => {
    const config = defaultConfig("hair");
    expect(render(config, emptySalon)).not.toContain('id="piece-about"');
    const editor = renderToStaticMarkup(<Site config={config} data={emptySalon} t={tFor("es")} empty={(k) => <p>empty:{k}</p>} />);
    expect(editor).toContain("empty:about");
  });

  it("prices can be hidden", () => {
    expect(render({ ...defaultConfig("barbershop"), showPrices: false }, fullSalon)).not.toContain("€");
  });

  it("the email can be hidden", () => {
    expect(render(defaultConfig("hair"), fullSalon)).toContain(`mailto:${fullSalon.email}`);
    expect(render({ ...defaultConfig("hair"), showEmail: false }, fullSalon)).not.toContain("mailto:");
  });

  it("no outside scripts, embedded maps or trackers", () => {
    expect(render(ownTexts(defaultConfig("hair")), fullSalon)).not.toMatch(/<script|<iframe/);
  });

  it("carries the credit to Statio CRM and aioperants.com", () => {
    const html = render(defaultConfig("hair"), fullSalon);
    expect(html).toContain('href="https://statiocrm.com"');
    expect(html).toContain('href="https://aioperants.com"');
  });
});

describe("options on any kind of salon", () => {
  it("Just me: no team, About me", () => {
    const html = render({ ...ownTexts(defaultConfig("hair")), solo: true }, fullSalon);
    expect(html).not.toContain('id="team"');
    expect(html).toContain("Sobre mí");
  });

  it("We come to you: no address or map, the area instead", () => {
    const html = render({ ...defaultConfig("nails"), mobile: true, serviceArea: "Madrid centro" }, fullSalon);
    expect(html).not.toContain("Calle Mayor");
    expect(html).not.toContain("google.com/maps");
    expect(html).toContain("Madrid centro");
  });
});

describe("illustrated examples", () => {
  const empty = { ...fullSalon, heroImage: null, team: fullSalon.team.map((m) => ({ ...m, photo: null })) };

  it("fill empty photo spots in the preview, marked as examples", () => {
    const html = renderToStaticMarkup(<Site config={defaultConfig("barbershop")} data={empty} t={tFor("es")} exampleLabel="Ejemplo" />);
    expect(html).toContain('aria-label="Ejemplo"');
    expect(html).toContain('id="gallery"');
  });

  it("never appear on the published website", () => {
    const html = render(defaultConfig("barbershop"), empty);
    expect(html).not.toContain("Ejemplo");
    expect(html).not.toContain('id="gallery"');
  });
});

describe("our work", () => {
  it("links a photo to booking that service, without any script", () => {
    const photo = { id: "11111111-2222-3333-4444-555555555555", caption: "Balayage", serviceId: "bbbbbbbb-0000-4000-8000-000000000001" };
    const html = render({ ...defaultConfig("hair"), gallery: [photo] }, fullSalon);
    expect(html).toContain("/es/book?service=bbbbbbbb-0000-4000-8000-000000000001");
    expect(html).toContain('href="#photo-11111111-2222-3333-4444-555555555555"');
    expect(html).not.toContain("<script");
  });
});

describe("the stored settings are read safely", () => {
  it("keeps every section once in the fixed order, trims texts", () => {
    const c = readConfig({
      preset: "unknown",
      direction: "neon",
      pieces: [{ key: "team", on: false, layout: "carousel" }, { key: "hack", on: true }],
      tagline: "x".repeat(500),
      faq: [{ q: "Q", a: "" }, { q: "¿Niños?", a: "Sí" }],
    });
    expect(c.preset).toBe("hair");
    expect(c.direction).toBe("minimalist");
    expect(c.pieces.map((p) => p.key)).toEqual([...PIECES]);
    expect(c.pieces.find((p) => p.key === "team")).toEqual({ key: "team", on: false, layout: "grid" });
    expect(c.tagline).toHaveLength(140);
    expect(c.faq).toEqual([{ q: "¿Niños?", a: "Sí" }]);
  });
});

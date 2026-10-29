import { describe, expect, it } from "vitest";
import { legacyEsEn, readTexts, textIn } from "./texts";

describe("salon texts per language", () => {
  it("picks the language, then the salon's default, then any", () => {
    const t = { es: "Corte", de: "Haarschnitt" };
    expect(textIn(t, "de", "es")).toBe("Haarschnitt");
    expect(textIn(t, "vi", "es")).toBe("Corte");
    expect(textIn({ tr: "Kesim" }, "vi", "es")).toBe("Kesim");
    expect(textIn(null, "es")).toBe("");
  });
  it("reads only the offered languages and keeps the others", () => {
    const form = new FormData();
    form.set("name.es", " Corte ");
    form.set("name.de", "");
    expect(readTexts(form, "name", ["es", "de"], { de: "Alt", en: "Cut" })).toEqual({ es: "Corte", en: "Cut" });
  });
  it("keeps the old Spanish/English columns filled", () => {
    expect(legacyEsEn({ de: "Haarschnitt" }, "de")).toEqual({ es: "Haarschnitt", en: "Haarschnitt" });
  });
});

describe("untranslated names", () => {
  it("show in the salon's default language, not whichever language happens to be stored first", () => {
    expect(textIn({ en: "Men's cut", es: "Corte caballero" }, "de", "es")).toBe("Corte caballero");
  });
});

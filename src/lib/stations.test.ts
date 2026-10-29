import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import { kindLabel, normalizeKind, stationsLabel } from "./stations";

const all = [en.admin.chairs.kinds, es.admin.chairs.kinds];

describe("station types", () => {
  it("maps typed built-in names back to their type, in any language", () => {
    expect(normalizeKind("Lavacabezas", all)).toBe("basin");
    expect(normalizeKind("  pedicure chair ", all)).toBe("pedicure");
    expect(normalizeKind("room", all)).toBe("room");
  });
  it("keeps the salon's own types as typed", () => {
    expect(normalizeKind("Camilla  de masaje", all)).toBe("Camilla de masaje");
    expect(kindLabel("Camilla de masaje", en.admin.chairs.kinds)).toBe("Camilla de masaje");
  });
  it("shows built-in types translated", () => {
    expect(kindLabel("nail", es.admin.chairs.kinds)).toBe("Mesa de uñas");
    expect(kindLabel("nail", en.admin.chairs.kinds)).toBe("Nail desk");
  });
  it("uses the salon's section name, falling back to its default language", () => {
    expect(stationsLabel({ stationsLabels: { es: "Cabinas" }, defaultLocale: "es" }, "de")).toBe("Cabinas");
    expect(stationsLabel({ stationsLabels: {}, defaultLocale: "es" }, "es")).toBeNull();
  });
});

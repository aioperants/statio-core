import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import { BUSINESS_TYPES, TEMPLATES, templatePlan } from "./templates";

describe("business templates", () => {
  it("shares groups and services between types instead of repeating them", () => {
    const plan = templatePlan(["hair", "barber"]);
    expect(plan.groups.filter((g) => g === "cuts")).toHaveLength(1);
    expect(plan.services.filter((s) => s.key === "kidsCut")).toHaveLength(1);
    expect(plan.services.every((s) => plan.groups.includes(s.group))).toBe(true);
  });
  it("has a name for everything in both languages", () => {
    for (const type of BUSINESS_TYPES) {
      const t = TEMPLATES[type];
      for (const m of [en.templates, es.templates]) {
        expect(m.types[type]).toBeTruthy();
        for (const g of t.groups) expect(m.groups[g as keyof typeof m.groups]).toBeTruthy();
        for (const s of t.services) expect(m.services[s.key as keyof typeof m.services]).toBeTruthy();
        for (const s of t.stations) expect(m.stations[s.key as keyof typeof m.stations]).toBeTruthy();
      }
    }
  });
});

describe("laser hair removal template", () => {
  it("starts with a consultation and patch test, then areas in one room", () => {
    const plan = templatePlan(["laser"]);
    expect(plan.services[0].key).toBe("laserConsultation");
    expect(plan.services.every((s) => s.station === "room")).toBe(true);
    expect(plan.stations).toEqual([{ key: "treatmentRoom", kind: "room", count: 1 }]);
  });
});

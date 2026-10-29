import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";

function keys(o: object, prefix = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) => (typeof v === "object" && v && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
}
const value = (o: unknown, key: string) => key.split(".").reduce<unknown>((x, k) => (x as Record<string, unknown> | undefined)?.[k], o);
const placeholders = (v: unknown) => new Set(JSON.stringify(v ?? "").match(/\{(\w+)(?=[,}])/g) ?? []);

/** The admin is in English; every other language covers what clients see (booking, website, emails). */
const dir = path.join(__dirname, "../../messages");
const others = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "en.json");

describe("translations", () => {
  for (const file of others) {
    const m = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    it(`${file}: only English's keys, with the same placeholders`, () => {
      const english = new Set(keys(en));
      for (const k of keys(m)) {
        expect(english.has(k), k).toBe(true);
        for (const p of placeholders(value(m, k))) expect(placeholders(value(en, k)).has(p), `${k} uses ${p}`).toBe(true);
      }
    });
    it(`${file}: the whole booking page`, () => {
      expect(keys(m.book).length).toBe(keys(en.book).length);
    });
  }
});

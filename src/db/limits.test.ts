/**
 * Limits counted in the database. Needs the database: npm run test:db.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { tooMany } from "@/lib/limits";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("limits", () => {
  it("counts in the database, so every server counts together", async () => {
    const key = `test:${randomUUID()}`;
    const results = await Promise.all(Array.from({ length: 5 }, () => tooMany(key, 3, 60)));
    expect(results.filter(Boolean)).toHaveLength(2);
    expect(await tooMany(key, 3, 60)).toBe(true);
  });

  it("a new window starts once the old one is over", async () => {
    const key = `test:${randomUUID()}`;
    expect(await tooMany(key, 1, 1)).toBe(false);
    expect(await tooMany(key, 1, 1)).toBe(true);
    await new Promise((r) => setTimeout(r, 1100));
    expect(await tooMany(key, 1, 1)).toBe(false);
  });
});

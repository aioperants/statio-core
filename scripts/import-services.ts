/**
 * Adds services from a JSON file, for setting a salon up from its price list (by hand or with an
 * AI agent, see .claude/skills/statio-services): npm run services:import -- services.json
 *
 * The file is a list: [{ "name": "Corte y peinado", "minutes": 45, "price": 35, "group": "Mujer",
 * "description": "…", "rebookDays": 35 }]. "group", "description" and "rebookDays" are optional.
 * Groups are created when missing. Everyone who takes bookings can do the new services; change
 * that per person on the Team screen. Nothing is deleted or changed: it only adds.
 */
import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../src/db";

const row = z.object({
  name: z.string().trim().min(1).max(100),
  minutes: z.number().int().min(5).max(600),
  price: z.number().min(0).max(100_000),
  group: z.string().trim().max(60).optional(),
  description: z.string().trim().max(500).optional(),
  rebookDays: z.number().int().min(1).max(365).optional(),
});

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Usage: npm run services:import -- services.json");
  const rows = z.array(row).min(1).max(200).parse(JSON.parse(readFileSync(file, "utf8")));
  // One salon per copy of Statio Core.
  const salon = await db.query.business.findFirst({ columns: { id: true, defaultLocale: true } });
  if (!salon) throw new Error("No salon yet: open /setup in the browser first.");
  const added = await addServices(rows, salon.defaultLocale);
  console.log(`Added ${added} services.`);
  process.exit(0);
}

async function addServices(rows: z.infer<typeof row>[], lang: string) {
  return db.transaction(async (tx) => {
    const groups = await tx.query.serviceCategory.findMany();
    const groupOf = async (name: string | undefined) => {
      if (!name) return null;
      const found = groups.find((g) => (g.names?.[lang] ?? g.nameEs).toLowerCase() === name.toLowerCase());
      if (found) return found;
      const [made] = await tx.insert(schema.serviceCategory).values({ names: { [lang]: name }, nameEs: name, nameEn: name, sortOrder: groups.length + 1 }).returning();
      groups.push(made);
      return made;
    };
    const order = (await tx.query.service.findMany({ columns: { id: true } })).length;
    const people = await tx.query.staff.findMany({ where: eq(schema.staff.active, true), columns: { id: true, bookable: true } });
    let n = 0;
    for (const r of rows) {
      const g = await groupOf(r.group);
      const [s] = await tx
        .insert(schema.service)
        .values({
          names: { [lang]: r.name },
          nameEs: r.name,
          nameEn: r.name,
          descriptions: r.description ? { [lang]: r.description } : {},
          categoryId: g?.id ?? null,
          categoryNames: g?.names ?? {},
          category: g?.nameEs ?? null,
          categoryEn: g?.nameEn ?? null,
          durationMin: r.minutes,
          priceCents: Math.round(r.price * 100),
          rebookDays: r.rebookDays ?? null,
          active: true,
          sortOrder: order + ++n,
        })
        .returning({ id: schema.service.id });
      const doers = people.filter((p) => p.bookable);
      if (doers.length) await tx.insert(schema.staffService).values(doers.map((p) => ({ staffId: p.id, serviceId: s.id }))).onConflictDoNothing();
    }
    return n;
  });
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

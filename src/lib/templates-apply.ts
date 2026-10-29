import "server-only";
import { eq } from "drizzle-orm";
import type en from "../../messages/en.json";
import { db, schema } from "@/db";
import { messagesFor } from "@/i18n/messages";
import { type BusinessType, templatePlan } from "./templates";

/**
 * Creates the starter groups, services and stations for the ticked business types, named in the
 * salon's client language. Services start hidden with no price; the owner prices and switches
 * them on. The given person (the owner) is set up to do all of them.
 */
export async function applyTemplates(types: BusinessType[], lang: string, staffId: string | null) {
  const plan = templatePlan(types);
  if (!plan.services.length) return 0;
  const words = (messagesFor(lang) as typeof en).templates;
  const name = (group: Record<string, string>, key: string) => group[key] ?? key;

  return db.transaction(async (tx) => {
    const groups = await tx
      .insert(schema.serviceCategory)
      .values(plan.groups.map((g, i) => ({ names: { [lang]: name(words.groups, g) }, nameEs: name(words.groups, g), nameEn: name(words.groups, g), sortOrder: i + 1 })))
      .returning();
    const groupOf = (g: string) => groups[plan.groups.indexOf(g)];
    const services = await tx
      .insert(schema.service)
      .values(
        plan.services.map((s, i) => {
          const n = name(words.services, s.key);
          const g = groupOf(s.group);
          return {
            names: { [lang]: n },
            nameEs: n,
            nameEn: n,
            categoryId: g.id,
            categoryNames: g.names,
            category: g.nameEs,
            categoryEn: g.nameEn,
            durationMin: s.minutes,
            rebookDays: s.rebookDays ?? null,
            colourCard: !!s.colour,
            needsConsent: !!s.colour,
            stationKind: s.station ?? null,
            priceCents: 0,
            active: false,
            sortOrder: i + 1,
          };
        }),
      )
      .returning({ id: schema.service.id });
    if (staffId) await tx.insert(schema.staffService).values(services.map((s) => ({ staffId, serviceId: s.id })));
    let order = 0;
    const chairs = plan.stations.flatMap((st) =>
      Array.from({ length: st.count }, (_, i) => ({
        name: st.count > 1 ? `${name(words.stations, st.key)} ${i + 1}` : name(words.stations, st.key),
        kind: st.kind,
        shared: st.shared ?? false,
        sortOrder: ++order,
      })),
    );
    if (chairs.length) await tx.insert(schema.chair).values(chairs);
    return services.length;
  });
}

/** The owner's staff id, for linking the starter services. */
export async function ownerId() {
  return (await db.query.staff.findFirst({ where: eq(schema.staff.role, "owner"), columns: { id: true } }))?.id ?? null;
}

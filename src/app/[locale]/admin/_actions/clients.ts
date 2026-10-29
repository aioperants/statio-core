"use server";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { audit, canEditClient, canSeeClient, requireStaff, requirePermission } from "@/lib/access";
import { requireBusiness } from "@/lib/booking";
import { clientsFromCsv } from "@/lib/csv";
import { toE164 } from "@/lib/phone";
import { allows } from "@/lib/permissions";

const clientForm = z.object({
  id: z.uuid().optional().or(z.literal("")),
  name: z.string().trim().min(1).max(120),
  email: z.email().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional(),
  notes: z.string().max(4000).optional(),
  tags: z.string().max(300).optional(),
  status: z.enum(["active", "needs_approval", "blocked"]).optional(),
  birthMonth: z.string().optional(),
  birthDay: z.string().optional(),
  heardFrom: z.string().trim().max(60).optional(),
  recommendedBy: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
});

/** "MM-DD" from the two birthday pickers, or null when either is empty or the date can't exist. */
function birthdayOf(month?: string, day?: string) {
  const m = Number(month);
  const d = Number(day);
  if (!m || !d) return null;
  const days = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return days && d <= days ? `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;
}

export async function saveClient(locale: string, form: FormData) {
  const me = await requireStaff();
  const p = clientForm.parse(Object.fromEntries(form));
  const values = {
    name: p.name,
    email: p.email ? p.email.toLowerCase() : null,
    phone: toE164(p.phone, (await requireBusiness()).country),
    notes: p.notes || null,
    birthday: birthdayOf(p.birthMonth, p.birthDay),
    heardFrom: p.heardFrom || null,
    recommendedBy: p.heardFrom === "recommended" ? p.recommendedBy || null : null,
    city: p.city || null,
    tags: (p.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10),
    // Only owners and managers can block clients.
    ...(p.status && allows(me, "clients", "full") ? { status: p.status } : {}),
  };
  let id = p.id || null;
  const existing = id ? await db.query.client.findFirst({ where: eq(schema.client.id, id), columns: { ownerStaffId: true } }) : null;
  if (id ? !existing || !canEditClient(me, existing) : !allows(me, "clients", "edit")) throw new Error("Not allowed");
  try {
    if (id) await db.update(schema.client).set(values).where(eq(schema.client.id, id));
    else [{ id }] = await db.insert(schema.client).values({ ...values, source: "admin" }).returning({ id: schema.client.id });
  } catch (err) {
    if ((err as { cause?: { code?: string } }).cause?.code === "23505" || (err as { code?: string }).code === "23505") {
      redirect(`/${locale}/admin/clients/${p.id || "new"}?error=duplicate`);
    }
    throw err;
  }
  await audit(me.userId, p.id ? "client.update" : "client.create", id!);
  revalidatePath("/[locale]/admin/clients", "layout");
  redirect(`/${locale}/admin/clients/${id}`);
}

/** Import a CSV of clients. Existing clients (same email) get missing phone/notes filled in. */
export async function importClients(locale: string, form: FormData) {
  const me = await requirePermission("clientData", "edit");
  const file = form.get("file");
  if (!(file instanceof File) || file.size > 5_000_000) redirect(`/${locale}/admin/clients/import?error=1`);
  const country = (await requireBusiness()).country;
  const rows = clientsFromCsv(await file.text())
    .slice(0, 10_000)
    .map((r) => ({ ...r, phone: toE164(r.phone, country) }));
  let added = 0;
  let updated = 0;
  let skipped = 0;
  for (const r of rows) {
    const existing = r.email
      ? await db.query.client.findFirst({ where: sql`lower(${schema.client.email}) = ${r.email}` })
      : r.phone
        ? await db.query.client.findFirst({ where: eq(schema.client.phone, r.phone) })
        : null;
    if (existing) {
      if ((!existing.phone && r.phone) || (!existing.notes && r.notes)) {
        await db
          .update(schema.client)
          .set({ phone: existing.phone ?? r.phone, notes: existing.notes ?? r.notes })
          .where(eq(schema.client.id, existing.id));
        updated++;
      } else skipped++;
      continue;
    }
    await db.insert(schema.client).values({ ...r, source: "import" });
    added++;
  }
  await audit(me.userId, "client.import", `${added} added, ${updated} updated`);
  revalidatePath("/[locale]/admin/clients", "layout");
  redirect(`/${locale}/admin/clients?imported=${added}-${updated}-${skipped}`);
}

/** A dated note on a client (what was done, formulas, likes), signed by whoever wrote it. */
export async function addClientNote(clientId: string, form: FormData) {
  const me = await requireStaff();
  const client = await db.query.client.findFirst({ where: eq(schema.client.id, z.uuid().parse(clientId)), columns: { id: true, ownerStaffId: true } });
  if (!client || !canSeeClient(me, client)) throw new Error("Not allowed");
  const text = z.string().trim().min(1).max(2000).parse(form.get("text"));
  await db.insert(schema.clientNote).values({ clientId: client.id, text, staffId: me.id });
  revalidatePath("/[locale]/admin/clients", "layout");
}

/** Whoever wrote a note can remove it; so can the owner or a manager. */
export async function deleteClientNote(id: string) {
  const me = await requireStaff();
  const note = await db.query.clientNote.findFirst({ where: eq(schema.clientNote.id, z.uuid().parse(id)) });
  if (!note || (!allows(me, "clients", "full") && note.staffId !== me.id)) throw new Error("Not allowed");
  await db.delete(schema.clientNote).where(eq(schema.clientNote.id, note.id));
  revalidatePath("/[locale]/admin/clients", "layout");
}

/** "This client comes every N weeks", set by hand; empty goes back to the automatic estimate. */
export async function setClientRhythm(clientId: string, form: FormData) {
  const me = await requireStaff();
  const client = await db.query.client.findFirst({ where: eq(schema.client.id, z.uuid().parse(clientId)), columns: { id: true, ownerStaffId: true } });
  if (!client || !canEditClient(me, client)) throw new Error("Not allowed");
  const weeks = Number(form.get("weeks"));
  const rhythmDays = Number.isInteger(weeks) && weeks >= 1 && weeks <= 52 ? weeks * 7 : null;
  await db.update(schema.client).set({ rhythmDays }).where(eq(schema.client.id, client.id));
  await audit(me.userId, "client.rhythm", rhythmDays ? `${weeks}w` : "auto");
  revalidatePath("/[locale]/admin/clients", "layout");
}

/**
 * Merge a duplicate into this client: their visits, notes and messages move here, missing
 * details are filled in from the duplicate, and the duplicate is removed. Owners and managers only.
 */
export async function mergeClients(locale: string, keepId: string, otherId: string) {
  const me = await requirePermission("clients", "full");
  const [keep, other] = await Promise.all([
    db.query.client.findFirst({ where: eq(schema.client.id, z.uuid().parse(keepId)) }),
    db.query.client.findFirst({ where: eq(schema.client.id, z.uuid().parse(otherId)) }),
  ]);
  if (!keep || !other || keep.id === other.id || keep.guest || other.guest) throw new Error("Not allowed");
  await db.transaction(async (tx) => {
    await tx.update(schema.appointment).set({ clientId: keep.id }).where(eq(schema.appointment.clientId, other.id));
    await tx.update(schema.clientNote).set({ clientId: keep.id }).where(eq(schema.clientNote.clientId, other.id));
    await tx.update(schema.messageLog).set({ clientId: keep.id }).where(eq(schema.messageLog.clientId, other.id));
    await tx.delete(schema.client).where(eq(schema.client.id, other.id));
    // Fill in what this client is missing from the duplicate.
    await tx
      .update(schema.client)
      .set({
        email: keep.email ?? other.email,
        phone: keep.phone ?? other.phone,
        userId: keep.userId ?? other.userId,
        notes: [keep.notes, other.notes].filter(Boolean).join("\n") || null,
        birthday: keep.birthday ?? other.birthday,
        rhythmDays: keep.rhythmDays ?? other.rhythmDays,
        heardFrom: keep.heardFrom ?? other.heardFrom,
        recommendedBy: keep.recommendedBy ?? other.recommendedBy,
        city: keep.city ?? other.city,
        locale: keep.locale ?? other.locale,
        ownerStaffId: keep.ownerStaffId ?? other.ownerStaffId,
        tags: [...new Set([...keep.tags, ...other.tags])].slice(0, 10),
        noShowCount: keep.noShowCount + other.noShowCount,
        createdAt: keep.createdAt < other.createdAt ? keep.createdAt : other.createdAt,
      })
      .where(eq(schema.client.id, keep.id));
  });
  await audit(me.userId, "client.merge", `${other.name} → ${keep.name}`);
  revalidatePath("/[locale]/admin", "layout");
  redirect(`/${locale}/admin/clients/${keep.id}?merged=1`);
}

/**
 * "Delete my data" (GDPR): the client's personal details and notes are erased; their visits stay,
 * without a name, so the salon's history and totals still add up. Owners and managers only.
 */
export async function eraseClient(locale: string, clientId: string) {
  const me = await requirePermission("clients", "full");
  const c = await db.query.client.findFirst({ where: eq(schema.client.id, z.uuid().parse(clientId)) });
  if (!c || c.guest) throw new Error("Not allowed");
  await db.transaction(async (tx) => {
    await tx.delete(schema.clientNote).where(eq(schema.clientNote.clientId, c.id));
    await tx.delete(schema.messageLog).where(eq(schema.messageLog.clientId, c.id));
    await tx.update(schema.appointment).set({ notes: null, formula: null, bookedForName: null }).where(eq(schema.appointment.clientId, c.id));
    await tx
      .update(schema.client)
      .set({
        name: "—",
        email: null,
        phone: null,
        userId: null,
        notes: null,
        birthday: null,
        heardFrom: null,
        recommendedBy: null,
        city: null,
        tags: [],
        marketingConsent: false,
        status: "blocked",
        erasedAt: new Date(),
      })
      .where(eq(schema.client.id, c.id));
  });
  // The log keeps that it happened, not who it was.
  await audit(me.userId, "client.erase", c.id);
  revalidatePath("/[locale]/admin", "layout");
  redirect(`/${locale}/admin/clients?erased=1`);
}

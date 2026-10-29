"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { audit, requireStaff } from "@/lib/access";
import { allows } from "@/lib/permissions";

const text = (v: FormDataEntryValue | null, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const photoOf = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "");
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s) && s.length < 300_000 ? s : null;
};

/** Staff look after their own things; the owner and managers look after everything. */
async function mayEdit(me: Awaited<ReturnType<typeof requireStaff>>, ownerStaffId: string | null) {
  return allows(me, "equipment", "edit") || ownerStaffId === me.id;
}

export async function saveEquipment(locale: string, form: FormData) {
  const me = await requireStaff();
  const id = form.get("id") ? z.uuid().parse(form.get("id")) : null;
  const existing = id ? await db.query.equipment.findFirst({ where: eq(schema.equipment.id, id) }) : null;
  if (id && (!existing || !(await mayEdit(me, existing.ownerStaffId)))) throw new Error("Not allowed");
  // Staff can only add things as their own.
  const owner = !allows(me, "equipment", "edit") ? me.id : form.get("owner") ? z.uuid().parse(form.get("owner")) : null;
  const salonOwned = owner === null;
  const cost = Number(String(form.get("monthlyCost") ?? "").replace(",", "."));
  const values = {
    name: z.string().min(1).parse(text(form.get("name"), 100)),
    kind: form.get("kind") === "equipment" ? "equipment" : "tool",
    ownerStaffId: owner,
    location: text(form.get("location"), 100),
    note: text(form.get("note"), 500),
    photo: photoOf(form.get("photo")),
    // Renting is for the salon's own equipment (it's a salon cost).
    rented: salonOwned && form.get("rented") === "on",
    monthlyCostCents: salonOwned && form.get("rented") === "on" && Number.isFinite(cost) && cost > 0 ? Math.round(cost * 100) : null,
  };
  if (id) await db.update(schema.equipment).set(values).where(eq(schema.equipment.id, id));
  else await db.insert(schema.equipment).values(values);
  await audit(me.userId, id ? "equipment.update" : "equipment.create", values.name);
  revalidatePath("/[locale]/admin", "layout");
  redirect(`/${locale}/admin/equipment`);
}

export async function deleteEquipment(locale: string, id: string) {
  const me = await requireStaff();
  const item = await db.query.equipment.findFirst({ where: eq(schema.equipment.id, z.uuid().parse(id)) });
  if (!item || !(await mayEdit(me, item.ownerStaffId))) throw new Error("Not allowed");
  await db.delete(schema.equipment).where(eq(schema.equipment.id, item.id));
  await audit(me.userId, "equipment.delete", item.name);
  revalidatePath("/[locale]/admin", "layout");
  redirect(`/${locale}/admin/equipment`);
}

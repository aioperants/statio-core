"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db";
import { audit, requireStaff, managesAllVisits } from "@/lib/access";
import { appointmentDetails, pendingAppointments } from "@/lib/booking";
import { changeVisit } from "./visits";

/** Approve every request this person may handle; returns how many went through. */
export async function approveAll() {
  const me = await requireStaff();
  const list = (await pendingAppointments()).filter((a) => managesAllVisits(me) || a.staffId === me.id);
  let approved = 0;
  for (const a of list) if ((await changeVisit(a.id, "approve")).ok) approved++;
  return approved;
}

/** The welcome went out from the owner's phone, or they chose to skip it; either way it leaves the list. */
export async function markWelcome(appointmentId: string, how: "whatsapp" | "sms" | "skipped") {
  const me = await requireStaff();
  const a = await appointmentDetails({ id: z.uuid().parse(appointmentId) });
  if (!a || (!managesAllVisits(me) && a.staffId !== me.id)) throw new Error("Not allowed");
  await db.insert(schema.messageLog).values({
    appointmentId: a.id,
    clientId: a.clientId,
    channel: how === "skipped" ? "none" : how,
    template: "welcome",
    to: a.client.phone ?? "",
    status: how === "skipped" ? "skipped" : "sent",
  });
  await audit(me.userId, "client.welcome", `${a.clientId} ${how}`);
  revalidatePath("/[locale]/admin", "layout");
}

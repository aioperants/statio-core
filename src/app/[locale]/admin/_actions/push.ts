"use server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/access";
import { pushReady, pushToStaff, pushWords } from "@/lib/push";

const device = z.object({ endpoint: z.url().max(1000), keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }) });

/** This device now gets the person's notifications. */
export async function savePushDevice(input: unknown) {
  const p = device.safeParse(input);
  if (!p.success || !pushReady()) return { ok: false as const };
  const me = await requireStaff();
  await db
    .insert(schema.pushDevice)
    .values({ staffId: me.id, endpoint: p.data.endpoint, p256dh: p.data.keys.p256dh, auth: p.data.keys.auth })
    .onConflictDoUpdate({ target: [schema.pushDevice.businessId, schema.pushDevice.endpoint], set: { staffId: me.id, p256dh: p.data.keys.p256dh, auth: p.data.keys.auth } });
  return { ok: true as const };
}

/** This device stops getting them. */
export async function removePushDevice(endpoint: string) {
  const me = await requireStaff();
  await db.delete(schema.pushDevice).where(and(eq(schema.pushDevice.staffId, me.id), eq(schema.pushDevice.endpoint, endpoint)));
  return { ok: true as const };
}

/** "Send a test": to all of the person's devices. */
export async function testPush() {
  const me = await requireStaff();
  const sent = await pushToStaff([me.id], (locale) => {
    const t = pushWords(locale);
    return { title: t("testTitle"), body: t("testBody"), url: `/${locale}/admin`, tag: "test" };
  });
  return { ok: sent > 0 };
}

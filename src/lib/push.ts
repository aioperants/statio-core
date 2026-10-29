import "server-only";
import { createTranslator } from "next-intl";
import webpush from "web-push";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type en from "../../messages/en.json";
import { db, schema } from "@/db";
import { isAvailable, messagesFor } from "@/i18n/messages";
import { managesAllVisits } from "./access";
import { getBusiness } from "./booking";

/**
 * Notifications on the team's own phones and computers (web push, free): a new booking request,
 * a client cancelling or moving, the morning note and the end-of-day "close today's visits".
 * Off until the server has its VAPID keys (npx web-push generate-vapid-keys).
 */
export const pushReady = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

export type PushText = { title: string; body: string; url: string; tag?: string };

let configured = false;
function configure() {
  if (configured) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? `mailto:${process.env.OWNER_EMAIL ?? "owner@example.com"}`, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

/** Sends to every device of these people; a device the browser has dropped is forgotten. */
export async function pushToStaff(staffIds: string[], text: (locale: string) => PushText | null) {
  if (!pushReady() || !staffIds.length) return 0;
  configure();
  const business = await getBusiness();
  const devices = await db
    .select({ id: schema.pushDevice.id, endpoint: schema.pushDevice.endpoint, p256dh: schema.pushDevice.p256dh, auth: schema.pushDevice.auth, locale: schema.staff.locale })
    .from(schema.pushDevice)
    .innerJoin(schema.staff, eq(schema.staff.id, schema.pushDevice.staffId))
    .where(and(inArray(schema.pushDevice.staffId, staffIds), eq(schema.staff.active, true), isNull(schema.staff.pausedAt)));
  let sent = 0;
  for (const d of devices) {
    const message = text(pushLocale(d.locale, business?.defaultLocale));
    if (!message) continue;
    try {
      await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, JSON.stringify(message), { TTL: 60 * 60 * 12 });
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.delete(schema.pushDevice).where(eq(schema.pushDevice.id, d.id));
      else console.error("Push failed:", (err as Error).message);
    }
  }
  return sent;
}

/** The person's own language, else the salon's. */
export const pushLocale = (own: string | null | undefined, salon: string | undefined) => (isAvailable(own) ? own! : isAvailable(salon) ? salon! : "en");

/** The words for a notification, in `locale`. */
export const pushWords = (locale: string) => createTranslator({ locale, messages: messagesFor(locale) as typeof en, namespace: "push" });

/** Who hears about a visit: whoever manages all visits, and the person doing it (null: managers only). */
export async function visitWatchers(staffId: string | null) {
  const team = await db.query.staff.findMany({ where: and(eq(schema.staff.active, true), isNull(schema.staff.pausedAt)), columns: { id: true, access: true, permissions: true } });
  return team.filter((s) => s.id === staffId || managesAllVisits(s)).map((s) => s.id);
}

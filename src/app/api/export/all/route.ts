import { getTableColumns } from "drizzle-orm";
import { db, schema } from "@/db";
import { AccessError, audit, requireOwner } from "@/lib/access";
import { requireBusiness } from "@/lib/booking";
import { zip } from "@/lib/zip";

export const dynamic = "force-dynamic";

/** What never leaves: sign-in links and tokens, mail passwords, and how a person is linked to their sign-in. */
const SECRET = new Set(["inviteToken", "inviteExpiresAt", "userId", "manageToken", "recoveryEmail", "ipHash"]);
const clean = (rows: Record<string, unknown>[]) => rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !SECRET.has(k))));

/** A cell for Excel: quoted, spreadsheet formulas neutralised (as api/export/csv). */
const cell = (v: unknown) => {
  const s = v instanceof Date ? v.toISOString() : Array.isArray(v) || (v && typeof v === "object") ? JSON.stringify(v) : v == null ? "" : String(v);
  const short = /^data:image\//.test(s) ? "(picture, see photos/)" : s;
  return `"${(/^[=+\-@\t\r]/.test(short) ? `'${short}` : short).replace(/"/g, '""')}"`;
};
function csv(rows: Record<string, unknown>[], columns: string[]) {
  const head = columns.filter((k) => !SECRET.has(k));
  return "﻿" + [head.map(cell).join(","), ...rows.map((r) => head.map((k) => cell(r[k])).join(","))].join("\r\n");
}
function picture(name: string, dataUrl: unknown) {
  const m = typeof dataUrl === "string" ? /^data:image\/(jpeg|png|webp|svg\+xml);base64,(.+)$/.exec(dataUrl) : null;
  return m ? { name: `photos/${name}.${m[1] === "svg+xml" ? "svg" : m[1] === "jpeg" ? "jpg" : m[1]}`, data: Buffer.from(m[2], "base64") } : null;
}

/**
 * "Download everything": the whole salon in one ZIP, theirs to take anywhere. Spreadsheets (CSV,
 * open in Excel or Google Sheets) for the main lists, all of it as JSON (to import into their own
 * Statio, the code is public), and the pictures as files. Owner only: it holds every client.
 */
export async function GET() {
  let me;
  try {
    me = await requireOwner();
  } catch (err) {
    if (err instanceof AccessError) return new Response("Not allowed", { status: 403 });
    throw err;
  }
  const b = await requireBusiness();
  // Inside this salon's walls (row-level security): every query below only sees its own rows.
  const q = schema;
  const tables = {
    salon: [b],
    team: await db.select().from(q.staff),
    staff_services: await db.select().from(q.staffService),
    working_hours: await db.select().from(q.workingHours),
    time_off: await db.select().from(q.timeOff),
    opening_hours: await db.select().from(q.businessHours),
    online_hours: await db.select().from(q.onlineHours),
    service_categories: await db.select().from(q.serviceCategory),
    services: await db.select().from(q.service),
    chairs: await db.select().from(q.chair),
    equipment: await db.select().from(q.equipment),
    clients: await db.select().from(q.client),
    client_notes: await db.select().from(q.clientNote),
    visits: await db.select().from(q.appointment),
    visit_lines: await db.select().from(q.appointmentLine),
    website: await db.select().from(q.website),
    website_photos: await db.select().from(q.websitePhoto),
    messages_sent: await db.select().from(q.messageLog),
    activity: await db.select().from(q.auditLog),
  } as Record<string, Record<string, unknown>[]>;
  const data = Object.fromEntries(Object.entries(tables).map(([k, rows]) => [k, clean(rows)]));

  const photos = [
    picture("logo", b.logo),
    ...tables.website.flatMap((w) => [picture("cover", w.heroPublished), picture("cover-draft", w.heroDraft)]),
    ...tables.website_photos.map((p) => picture(`gallery-${p.id}`, p.data)),
    ...tables.team.map((s) => picture(`team-${String(s.name).replace(/[^\p{L}\p{N}]+/gu, "-")}-${String(s.id).slice(0, 8)}`, s.photo)),
  ].filter((p) => p !== null) as { name: string; data: Uint8Array }[];

  // Spreadsheets for the main lists, with their column names even when a list is empty.
  const sheets = { clients: q.client, visits: q.appointment, visit_lines: q.appointmentLine, services: q.service, team: q.staff, client_notes: q.clientNote };
  const day = new Date().toISOString().slice(0, 10);
  const file = zip([
    { name: "README.txt", data: `${b.name}: everything, ${day}.\r\n\r\n- The .csv files open in Excel, Numbers or Google Sheets.\r\n- statio-data.json has all of it, to import into your own Statio CRM.\r\n- photos/ has your logo, website photos and team photos.\r\n` },
    ...Object.entries(sheets).map(([k, table]) => ({ name: `${k}.csv`, data: csv(data[k], Object.keys(getTableColumns(table))) })),
    { name: "statio-data.json", data: JSON.stringify({ exportedAt: new Date().toISOString(), version: 1, ...data }, null, 2) },
    ...photos,
  ]);
  await audit(me.userId, "salon.export_all", `${tables.clients.length} clients, ${tables.visits.length} visits`);
  return new Response(new Uint8Array(file), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="salon-${day}.zip"`, "Cache-Control": "no-store" },
  });
}

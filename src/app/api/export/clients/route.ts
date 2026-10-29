import { and, asc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { AccessError, audit, clientsVisibleTo, requirePermission } from "@/lib/access";

const cell = (v: unknown) => {
  const s = Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v);
  // Quote everything; neutralise spreadsheet formulas.
  return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** The salon's whole client list as CSV: their data, theirs to take anywhere. */
export async function GET() {
  let me;
  try {
    // Downloading the client list is its own permission: only the owner, unless they allow someone.
    me = await requirePermission("clientData", "view");
  } catch (err) {
    if (err instanceof AccessError) return new Response("Not allowed", { status: 403 });
    throw err;
  }
  // A chair renter's clients are theirs: only the people this person may see.
  const rows = await db.query.client.findMany({ where: and(eq(schema.client.guest, false), isNull(schema.client.erasedAt), clientsVisibleTo(me)), orderBy: asc(schema.client.name) });
  const head = ["name", "email", "phone", "notes", "tags", "no_shows", "status", "created_at"];
  const body = rows.map((c) => [c.name, c.email, c.phone, c.notes, c.tags, c.noShowCount, c.status, c.createdAt.toISOString()].map(cell).join(","));
  await audit(me.userId, "client.export", `${rows.length}`);
  return new Response("﻿" + [head.join(","), ...body].join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="clients.csv"', "Cache-Control": "no-store" },
  });
}

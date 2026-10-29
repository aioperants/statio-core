/** A CSV download: every cell quoted, spreadsheet formulas neutralised, with a BOM for Excel. */
const cell = (v: unknown) => {
  const s = Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v);
  return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

export function csv(filename: string, head: string[], rows: unknown[][]) {
  const body = rows.map((r) => r.map(cell).join(","));
  return new Response("﻿" + [head.join(","), ...body].join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
  });
}

/** Minimal CSV reader: quotes, escaped quotes, comma or semicolon (Spanish Excel) separators. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

export interface ImportedClient {
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

const COLUMNS: Record<keyof ImportedClient | "first" | "last", RegExp> = {
  name: /^(name|nombre|full ?name|nombre completo|client|cliente)$/i,
  first: /^(first ?name|given ?name|nombre de pila)$/i,
  last: /^(last ?name|family ?name|surname|apellidos?)$/i,
  email: /^(e-?mail|correo|correo electr[oó]nico|e-?mail address)( ?1)?( - value)?$/i,
  phone: /^(phone|tel[eé]fono|mobile|m[oó]vil|cell|phone number|n[uú]mero)( ?1)?( - value)?$/i,
  notes: /^(notes?|notas?|comments?|comentarios?)$/i,
};

/** Clients from a CSV export (phone contacts, Excel, Booksy, Fresha). The first row must be headers. */
export function clientsFromCsv(text: string): ImportedClient[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const find = (key: keyof typeof COLUMNS) => header.findIndex((h) => COLUMNS[key].test(h.trim()));
  const idx = { name: find("name"), first: find("first"), last: find("last"), email: find("email"), phone: find("phone"), notes: find("notes") };
  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  return rows
    .map((r) => {
      const name = get(r, idx.name) || [get(r, idx.first), get(r, idx.last)].filter(Boolean).join(" ");
      const email = get(r, idx.email).toLowerCase();
      return {
        name,
        email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null,
        phone: get(r, idx.phone) || null,
        notes: get(r, idx.notes) || null,
      };
    })
    .filter((c) => c.name);
}

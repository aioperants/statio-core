import "server-only";
import fs from "node:fs";
import path from "node:path";
import { FALLBACK, LANGUAGES } from "./languages";

type Messages = Record<string, unknown>;
const dir = path.join(process.cwd(), "messages");
const cache = new Map<string, Messages | null>();

function read(code: string): Messages | null {
  if (!cache.has(code) || process.env.NODE_ENV !== "production") {
    const file = path.join(dir, `${code}.json`);
    cache.set(code, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null);
  }
  return cache.get(code)!;
}

function merge(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" ? merge(base[k] as Messages, v as Messages) : v;
  }
  return out;
}

/** The app's words in `code`, with English filling any gaps. */
export function messagesFor(code: string): Messages {
  const fallback = read(FALLBACK) ?? {};
  const own = code === FALLBACK ? null : read(code);
  return own ? merge(fallback, own) : fallback;
}

/** Languages that have a translation file, in the catalog's order. */
export function availableLanguages() {
  return LANGUAGES.filter((l) => read(l.code) !== null);
}

export const isAvailable = (code: string | null | undefined) => !!code && availableLanguages().some((l) => l.code === code);

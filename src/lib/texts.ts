/** Text the salon writes, one per language code: { es: "Corte", en: "Cut" }. */
export type Texts = Record<string, string>;

/** The text in `locale`, else in `fallback` (the salon's default language), else any it has. */
export function textIn(t: Texts | null | undefined, locale: string, fallback?: string): string {
  if (!t) return "";
  return t[locale]?.trim() || (fallback && t[fallback]?.trim()) || Object.values(t).find((v) => v?.trim()) || "";
}

/**
 * Reads `<field>.<code>` inputs for the offered languages. Languages not on the form (no longer
 * offered) keep what was saved before; an emptied field removes that language.
 */
export function readTexts(form: FormData, field: string, langs: readonly string[], before: Texts = {}, max = 500): Texts {
  const out: Texts = { ...before };
  for (const l of langs) {
    const key = `${field}.${l}`;
    if (!form.has(key)) continue;
    const v = String(form.get(key) ?? "").trim().slice(0, max);
    if (v) out[l] = v;
    else delete out[l];
  }
  return out;
}

/** The old Spanish/English columns, kept filled so an older app version still shows something. */
export function legacyEsEn(t: Texts, fallback: string) {
  const any = textIn(t, fallback);
  return { es: t.es || any, en: t.en || any };
}

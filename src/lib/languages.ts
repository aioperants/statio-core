import { languageName } from "@/i18n/languages";

/** For forms: each language code with its own name. */
export const langOptions = (codes: string[]) => codes.map((code) => ({ code, name: languageName(code) }));

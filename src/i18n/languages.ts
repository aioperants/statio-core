/**
 * Every language the app knows how to name and route to. A language is *available* (shown in
 * the pickers) once messages/<code>.json exists; strings missing from that file fall back to
 * English. Adding a language = adding its file here in messages/.
 */
export const LANGUAGES = [
  { code: "es", name: "Español" },
  { code: "en", name: "English" },
  { code: "ca", name: "Català" },
  { code: "eu", name: "Euskara" },
  { code: "gl", name: "Galego" },
  { code: "pt", name: "Português" },
  { code: "fr", name: "Français" },
  { code: "it", name: "Italiano" },
  { code: "de", name: "Deutsch" },
  { code: "nl", name: "Nederlands" },
  { code: "da", name: "Dansk" },
  { code: "sv", name: "Svenska" },
  { code: "nb", name: "Norsk bokmål" },
  { code: "fi", name: "Suomi" },
  { code: "et", name: "Eesti" },
  { code: "lv", name: "Latviešu" },
  { code: "lt", name: "Lietuvių" },
  { code: "pl", name: "Polski" },
  { code: "cs", name: "Čeština" },
  { code: "sk", name: "Slovenčina" },
  { code: "sl", name: "Slovenščina" },
  { code: "hr", name: "Hrvatski" },
  { code: "sr", name: "Српски" },
  { code: "hu", name: "Magyar" },
  { code: "ro", name: "Română" },
  { code: "bg", name: "Български" },
  { code: "el", name: "Ελληνικά" },
  { code: "uk", name: "Українська" },
  { code: "ru", name: "Русский" },
  { code: "tr", name: "Türkçe" },
  { code: "ar", name: "العربية", rtl: true },
  { code: "he", name: "עברית", rtl: true },
  { code: "fa", name: "فارسی", rtl: true },
  { code: "hi", name: "हिन्दी" },
  { code: "bn", name: "বাংলা" },
  { code: "ur", name: "اردو", rtl: true },
  { code: "th", name: "ไทย" },
  { code: "vi", name: "Tiếng Việt" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "ms", name: "Bahasa Melayu" },
  { code: "tl", name: "Filipino" },
  { code: "zh", name: "中文" },
  { code: "ja", name: "日本語" },
  { code: "ko", name: "한국어" },
] as const satisfies readonly { code: string; name: string; rtl?: boolean }[];

export type LangCode = (typeof LANGUAGES)[number]["code"];
export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as LangCode[];
/** Missing strings in any language show in this one. */
export const FALLBACK = "en";
/** Statio Core's admin language: other languages cover only what clients see (booking, website, emails). */
export const ADMIN_LOCALE = "en";

export const languageName = (code: string) => LANGUAGES.find((l) => l.code === code)?.name ?? code;
export const isRtl = (code: string) => LANGUAGES.some((l) => l.code === code && "rtl" in l && l.rtl);

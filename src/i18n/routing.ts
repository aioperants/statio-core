import { defineRouting } from "next-intl/routing";
import { LANGUAGE_CODES } from "./languages";

export const routing = defineRouting({
  locales: LANGUAGE_CODES,
  defaultLocale: "en",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

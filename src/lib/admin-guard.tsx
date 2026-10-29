import { getTranslations } from "next-intl/server";
import { allows, type Area, type Level } from "./permissions";
import { staffForPage } from "./access";

/** Settings-type pages: the person needs `level` in `area` (by default, editing settings). */
export async function managerOnly(locale: string, area: Area = "settings", level: Exclude<Level, "none"> = "edit") {
  const me = await staffForPage(locale);
  if (me && allows(me, area, level)) return { me, denied: null };
  const t = await getTranslations("common");
  return { me: null, denied: <p className="p-8 text-center text-muted">{t("notAllowed")}</p> };
}

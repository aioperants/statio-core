import { useTranslations } from "next-intl";
import { Calendar } from "@/components/icons";

/** "Add to my calendar" (.ics, iPhone/Outlook) and Google Calendar (Android), for a confirmed visit. */
export function AddToCalendar({ token, locale, primary = true }: { token: string; locale: string; primary?: boolean }) {
  const t = useTranslations("book");
  const href = `/api/calendar/${token}?lang=${locale}`;
  return (
    <div className="grid gap-2">
      <a href={href} className={primary ? "btn-primary" : "btn-ghost"}>
        <Calendar className="inline size-4 align-[-3px]" /> {t("addCalendar")}
      </a>
      <a href={`${href}&to=google`} target="_blank" rel="noreferrer" className="btn-ghost">
        {t("addGoogle")}
      </a>
      <p className="text-xs text-muted">{t("calendarHint")}</p>
    </div>
  );
}

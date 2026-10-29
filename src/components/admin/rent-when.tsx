"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** "Every month on the 1st" / "every week on Monday": posts `every` and `day`. */
export function RentWhen(props: { every: "month" | "week"; day: number; locale: string }) {
  const t = useTranslations("admin.money.when");
  const [every, setEvery] = useState(props.every);
  const [day, setDay] = useState(props.day);
  const weekday = (i: number) => new Intl.DateTimeFormat(props.locale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + i)));
  return (
    <>
      <label>
        <span className="label">{t("every")}</span>
        <select name="every" value={every} onChange={(e) => (setEvery(e.target.value as "month" | "week"), setDay(e.target.value === "week" ? 0 : 1))} className="field">
          <option value="month">{t("month")}</option>
          <option value="week">{t("week")}</option>
        </select>
      </label>
      <label>
        <span className="label">{t("on")}</span>
        <select name="day" value={day} onChange={(e) => setDay(Number(e.target.value))} className="field">
          {every === "week"
            ? Array.from({ length: 7 }, (_, i) => (
                <option key={i} value={i}>
                  {weekday(i)}
                </option>
              ))
            : Array.from({ length: 28 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {t("dayOfMonth", { day: i + 1 })}
                </option>
              ))}
        </select>
      </label>
    </>
  );
}

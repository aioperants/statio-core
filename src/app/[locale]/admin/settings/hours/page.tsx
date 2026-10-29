import { and, asc, gt, isNull } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { WeekHours } from "@/components/admin/week-hours";
import { Field, PageHeader, SubmitButton } from "@/components/admin/ui";
import { db, schema } from "@/db";
import { managerOnly } from "@/lib/admin-guard";
import { requireBusiness } from "@/lib/booking";
import { dayLabel } from "@/lib/format";
import { addDays, todayIn, utcToLocal } from "@/lib/time";
import { holidayCountries, holidayRegions, holidaysBetween } from "@/lib/holidays";
import { addClosure, addHolidays, removeClosure, saveOpeningHours } from "../../_actions/hours";

export default async function OpeningHoursPage({ params, searchParams }: PageProps<"/[locale]/admin/settings/hours">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { denied } = await managerOnly(locale);
  if (denied) return denied;
  const t = await getTranslations("admin.hours");
  const ts = await getTranslations("admin.staff");
  const tc = await getTranslations("common");
  const sp = await searchParams;
  const business = await requireBusiness();
  const today = todayIn(business.timezone);
  const [rows, closures] = await Promise.all([
    db.query.businessHours.findMany(),
    db.query.timeOff.findMany({ where: and(isNull(schema.timeOff.staffId), gt(schema.timeOff.endsAt, new Date())), orderBy: asc(schema.timeOff.startsAt) }),
  ]);
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + i))));
  const initial = rows.map((r) => ({ weekday: r.weekday, start: r.startMin, end: r.endMin }));
  const span = (c: (typeof closures)[number]) => {
    const from = utcToLocal(c.startsAt, business.timezone);
    const to = utcToLocal(new Date(+c.endsAt - 1), business.timezone);
    const d = (x: string) => dayLabel(x, locale, "short");
    return from.day === to.day ? d(from.day) : `${d(from.day)} – ${d(to.day)}`;
  };

  // "Add public holidays": the next 12 months for the chosen country (and region).
  const th = await getTranslations("admin.holidays");
  const [savedCountry, savedRegion] = (business.holidayRegion ?? "").split("-");
  const country = typeof sp.country === "string" && /^[A-Z]{2}$/.test(sp.country) ? sp.country : savedCountry || "";
  const regions = country ? holidayRegions(country, locale) : [];
  const region =
    typeof sp.region === "string" ? (regions.some((r) => r.code === sp.region) ? sp.region : "") : country === savedCountry ? savedRegion || "" : "";
  const holidays = country ? holidaysBetween(country, region || null, today, addDays(today, 365), business.defaultLocale) : [];
  const closedDays = new Set(
    closures.flatMap((c) => {
      const out: string[] = [];
      for (let d = utcToLocal(c.startsAt, business.timezone).day; d < utcToLocal(c.endsAt, business.timezone).day; d = addDays(d, 1)) out.push(d);
      return out;
    }),
  );

  return (
    <div>
      <PageHeader help={`/${locale}/admin/help#hours`} title={t("title")} back={`/${locale}/admin/settings/business`} />
      <div className="grid mx-auto w-full max-w-6xl grid-cols-1 gap-4 p-4 md:px-8">
        {sp.saved && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">✓ {tc("saved")}</p>}
        <form action={saveOpeningHours.bind(null, locale)} className="grid gap-4">
          <div className="card grid gap-1 p-4">
            <h2 className="font-semibold">{t("weekly")}</h2>
            <p className="mb-2 text-sm text-muted">{rows.length ? t("hint") : t("notSet")}</p>
            <WeekHours
              weekdays={weekdays}
              hours={initial.length ? initial : [0, 1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: 540, end: 1200 }))}
              labels={{ split: ts("split"), off: t("closed") }}
            />
          </div>
          <SubmitButton>{tc("save")}</SubmitButton>
        </form>

        <section className="card grid gap-3 p-4">
          <div>
            <h2 className="font-semibold">{t("closures")}</h2>
            <p className="text-sm text-muted">{t("closuresHint")}</p>
          </div>
          {closures.length > 0 && (
            <ul className="divide-y divide-line">
              {closures.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{span(c)}</span>
                    {c.reason && <span className="block truncate text-muted">{c.reason}</span>}
                  </span>
                  <form action={removeClosure.bind(null, locale, c.id)}>
                    <button className="btn-ghost min-h-9 px-3 py-1 text-sm text-red-700">{t("remove")}</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {sp.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{t("datesError")}</p>}
          {sp.holidays && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">✓ {th("added", { count: Number(sp.holidays) })}</p>}
          <form action={addClosure.bind(null, locale)} className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("from")}>
                <input name="from" type="date" required min={today} defaultValue={today} className="field" />
              </Field>
              <Field label={t("to")}>
                <input name="to" type="date" min={today} defaultValue={addDays(today, 0)} className="field" />
              </Field>
            </div>
            <Field label={t("reason")}>
              <input name="reason" maxLength={80} className="field" placeholder={t("reasonPlaceholder")} />
            </Field>
            <SubmitButton className="btn-ghost w-full">+ {t("addClosure")}</SubmitButton>
          </form>
        </section>

        <section className="card grid gap-3 p-4" id="holidays">
          <div>
            <h2 className="font-semibold">{th("title")}</h2>
            <p className="text-sm text-muted">{th("hint")}</p>
          </div>
          <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" action={`#holidays`}>
            <Field label={th("country")}>
              <select name="country" defaultValue={country} className="field">
                <option value="">—</option>
                {holidayCountries(locale).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            {regions.length > 0 ? (
              <Field label={th("region")}>
                <select name="region" defaultValue={region} className="field">
                  <option value="">{th("wholeCountry")}</option>
                  {regions.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <span />
            )}
            <button className="btn-ghost">{th("show")}</button>
          </form>
          {country && holidays.length === 0 && <p className="text-sm text-muted">{th("none")}</p>}
          {holidays.length > 0 && (
            <form action={addHolidays.bind(null, locale)} className="grid gap-3">
              <input type="hidden" name="region" value={region ? `${country}-${region}` : country} />
              <ul className="divide-y divide-line rounded-xl border border-line">
                {holidays.map((h) => {
                  const added = closedDays.has(h.day);
                  return (
                    <li key={h.day}>
                      <label className={`flex items-center gap-3 p-3 text-sm ${added ? "opacity-60" : "cursor-pointer"}`}>
                        <input type="checkbox" name="day" value={`${h.day}|${h.name}`} defaultChecked={h.official && !added} disabled={added} className="size-4 accent-brand" />
                        <span className="w-24 shrink-0 font-medium">{dayLabel(h.day, locale, "short")}</span>
                        <span className="min-w-0 flex-1">{h.name}</span>
                        {added ? (
                          <span className="chip bg-emerald-100 text-emerald-800">{th("closedChip")}</span>
                        ) : (
                          !h.official && <span className="chip bg-canvas text-muted">{th("localChip")}</span>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted">{th("untickHint")}</p>
              <SubmitButton>{th("add")}</SubmitButton>
              <p className="text-xs text-muted">{th("credit")}</p>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

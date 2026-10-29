import { getTranslations, setRequestLocale } from "next-intl/server";
import { TextsField } from "@/components/admin/texts-field";
import { Field, PageHeader, SubmitButton, Toggle } from "@/components/admin/ui";
import { managerOnly } from "@/lib/admin-guard";
import Link from "next/link";
import { HEARD_BUILT_IN } from "@/lib/heard";
import { SLOT_MODES } from "@/lib/slots";
import { salonLanguages } from "@/lib/salon-languages";
import { saveRules } from "../_actions/settings";
import { eq } from "drizzle-orm";
import { PlainMessage } from "@/components/admin/plain-message";
import { db, schema } from "@/db";
import { dayLabel, serviceName } from "@/lib/format";
import { plainForEditing } from "@/lib/owner-text";
import { welcomeDefaults } from "@/lib/welcome-texts";
import { salonUrl } from "@/lib/salon-url";
import { addDays, todayIn } from "@/lib/time";

export default async function RulesPage({ params, searchParams }: PageProps<"/[locale]/admin/rules">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { denied } = await managerOnly(locale);
  if (denied) return denied;
  const sp = await searchParams;
  const t = await getTranslations("admin.rules");
  const tc = await getTranslations("common");
  const tq = await getTranslations("heard");
  const tz = await getTranslations("admin.optimiser");
  const { business: b, options } = await salonLanguages();
  const section = "card grid grid-cols-1 gap-5 p-4";
  // The welcome: plain words in the salon's client language; the preview adds an example visit.
  const welcome = welcomeDefaults(b.defaultLocale);
  const tr = await getTranslations("admin.reviews");
  const te = await getTranslations({ locale: b.defaultLocale, namespace: "emails" });
  const sampleVisit = te("whatsappWelcomeVisit", {
    day: dayLabel(addDays(todayIn(b.timezone), 7), b.defaultLocale),
    time: "10:00",
    staff: "Ana",
    services: await db.query.service.findFirst({ where: eq(schema.service.active, true) }).then((x) => (x ? serviceName(x, b.defaultLocale) : "…")),
    link: `${salonUrl()}/${b.defaultLocale}/m/…`,
  });
  return (
    <div>
      <PageHeader help={`/${locale}/admin/help#rules`} title={t("title")} back={`/${locale}/admin/settings`} />
      <form action={saveRules.bind(null, locale)} className="grid grid-cols-1 mx-auto w-full max-w-6xl gap-4 p-4 md:px-8">
        {sp.saved && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">✓ {tc("saved")}</p>}
        <section className={section}>
          <h2 className="font-semibold">{t("approvals")}</h2>
          <div className="grid gap-2">
            {([false, true] as const).map((auto) => (
              <label key={String(auto)} className="flex items-start gap-3 rounded-xl border border-line p-3 has-checked:border-brand has-checked:bg-brand-soft">
                <input type="radio" name="autoApprove" value={auto ? "on" : "off"} defaultChecked={b.autoApprove === auto} className="mt-1 size-5 accent-brand" />
                <span>
                  <span className="block font-medium">{t(auto ? "acceptAll" : "approveNew")}</span>
                  <span className="block text-sm text-muted">{t(auto ? "acceptAllHint" : "approveNewHint")}</span>
                </span>
              </label>
            ))}
          </div>
          <Field label={t("cancellation")} hint={t("cancellationHint")}>
            <select name="cancellationHours" className="field" defaultValue={b.cancellationHours}>
              {[...new Set([0, 2, 4, 12, 24, 48, 72, b.cancellationHours])].sort((x, y) => x - y).map((h) => (
                <option key={h} value={h}>
                  {t("hoursBefore", { hours: h })}
                </option>
              ))}
            </select>
          </Field>
        </section>

        {/* Everything else has a good default: folded, so the three choices above are the page. */}
        <details className="group grid grid-cols-1 gap-4" open={Boolean(sp.more)}>
          <summary className="card flex cursor-pointer list-none items-center gap-3 p-4">
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{t("moreTitle")}</span>
              <span className="block text-sm text-muted">{t("moreHint")}</span>
            </span>
            <span className="text-muted transition group-open:rotate-90">›</span>
          </summary>
          <div className="mt-4 grid grid-cols-1 gap-4">
        <section className={section}>
          <h2 className="font-semibold">{t("newClients")}</h2>
          <p className="-mt-2 text-xs text-muted">{t("safetyNet", { count: b.noShowApprovalThreshold })}</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("noShowThreshold")}>
              <input name="noShowApprovalThreshold" type="number" min={1} max={10} className="field" defaultValue={b.noShowApprovalThreshold} />
            </Field>
            <Field label={t("maxFuture")}>
              <input name="maxFutureBookingsNewClient" type="number" min={1} max={20} className="field" defaultValue={b.maxFutureBookingsNewClient} />
            </Field>
          </div>
        </section>

        <section className={section}>
          <h2 id="day" className="scroll-mt-20 font-semibold">{t("day")}</h2>
          <Field label={tz("modeTitle")}>
            <div className="grid gap-2">
              {SLOT_MODES.map((m) => (
                <label key={m} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 has-checked:border-brand has-checked:bg-brand-soft">
                  <input type="radio" name="slotMode" value={m} defaultChecked={b.slotMode === m} className="mt-1 size-4 accent-brand" />
                  <span>
                    <span className="block font-medium">{tz(`modes.${m}`)}</span>
                    <span className="block text-sm text-muted">{tz(`modeHints.${m}`)}</span>
                  </span>
                </label>
              ))}
            </div>
          </Field>
          <Field label={t("dailyLimit")}>
            <select name="dailyLimit" className="field" defaultValue={b.dailyLimit ?? ""}>
              <option value="">{t("noLimit")}</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t("lead")}>
              <select name="leadMinutes" className="field" defaultValue={b.leadMinutes}>
                {[0, 1, 2, 3, 4, 12, 24, 48].map((h) => (
                  <option key={h} value={h * 60}>
                    {t("leadOptions", { hours: h })}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("horizon")}>
              <select name="horizonDays" className="field" defaultValue={b.horizonDays}>
                {[...new Set([7, 14, 28, 42, 56, 84, b.horizonDays])].sort((x, y) => x - y).map((d) => (
                  <option key={d} value={d}>
                    {d % 7 === 0 ? t("weeksAhead", { weeks: d / 7 }) : tc("daysCount", { count: d })}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("step")}>
              <select name="slotStepMin" className="field" defaultValue={b.slotStepMin}>
                {[5, 10, 15, 20, 30, 60].map((m) => (
                  <option key={m} value={m}>
                    {tc("minutes", { min: m })}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        <section className={section}>
          <div>
            <h2 className="font-semibold">{t("welcome")}</h2>
          </div>
          <PlainMessage
            name={`welcomeText.${b.defaultLocale}`}
            lang={b.defaultLocale}
            label={t("welcomeText")}
            hint={t("welcomeHint")}
            value={plainForEditing(b.welcomeTexts[b.defaultLocale]?.trim() ?? "", b.name) || welcome.message}
            ours={welcome.message}
            max={600}
            greeting={welcome.greeting.replaceAll("{name}", tr("previewName"))}
            after={[sampleVisit, b.name]}
            previewLabel={t("welcomePreview")}
          />
        </section>
        <section className={section}>
          <div>
            <h2 className="font-semibold">{tq("settingsTitle")}</h2>
            <p className="text-sm text-muted">{tq("settingsHint")}</p>
          </div>
          <Toggle name="askHeardFrom" label={tq("askHeard")} hint={tq("askHint")} defaultChecked={b.askHeardFrom} />
          <Field label={tq("answers")}>
            <div className="flex flex-wrap gap-2">
              {HEARD_BUILT_IN.map((o) => (
                <label key={o} className="flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm has-checked:border-brand has-checked:bg-brand-soft">
                  <input type="checkbox" name="heardOption" value={o} defaultChecked={b.heardOptions.includes(o)} className="size-4 accent-brand" />
                  {tq(o)}
                </label>
              ))}
            </div>
          </Field>
          <Field label={tq("ownAnswers")} hint={tq("ownAnswersHint")}>
            <input name="heardCustom" maxLength={200} className="field" defaultValue={b.heardOptions.filter((o) => !(HEARD_BUILT_IN as readonly string[]).includes(o)).join(", ")} />
          </Field>
          <Toggle name="askCity" label={tq("askCity")} hint={tq("askCityHint")} defaultChecked={b.askCity} />
        </section>
        <Link href={`/${locale}/admin/email`} className="card flex items-center gap-3 p-4">
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{t("emailTitle")}</span>
            <span className="block text-sm text-muted">{t("emailHint")}</span>
          </span>
          <span className="text-muted">›</span>
        </Link>
          </div>
        </details>
        <SubmitButton>{tc("save")}</SubmitButton>
      </form>
    </div>
  );
}

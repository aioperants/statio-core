import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Logo } from "@/components/brand";
import { VisitRow } from "@/components/admin/visit-row";
import { pageMember, managesAllVisits } from "@/lib/access";
import { allows } from "@/lib/permissions";
import { dayAppointments, requireBusiness } from "@/lib/booking";
import { dayLabel, hhmm, money } from "@/lib/format";
import { readiness } from "@/lib/readiness";
import { SetupBlock } from "@/components/admin/setup-block";
import { schedule } from "@/lib/schedule";
import { and, gte, isNotNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { addDays, localToUtc, todayIn, utcToLocal } from "@/lib/time";

export default async function TodayPage({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.today");
  const me = await pageMember(locale);
  const business = await requireBusiness();
  const today = todayIn(business.timezone);
  const mine = managesAllVisits(me) ? undefined : me.id;
  const [visits, sched] = await Promise.all([dayAppointments(today, { staffId: mine }), schedule(today, 1, { staffId: mine, gapMin: 45 })]);
  const nowMin = utcToLocal(new Date(), business.timezone).minutes;
  const tcash = await getTranslations("admin.cash");
  const tco = await getTranslations("admin.checkout");
  const tw = await getTranslations("admin.walkin");
  const tab = await getTranslations("admin.absence");
  const takings = await db
    .select({ method: schema.appointment.paymentMethod, total: sql<number>`sum(${schema.appointment.paidCents})`.mapWith(Number) })
    .from(schema.appointment)
    .where(
      and(
        isNotNull(schema.appointment.paidCents),
        gte(schema.appointment.paidAt, localToUtc(today, 0, business.timezone)),
        lt(schema.appointment.paidAt, localToUtc(addDays(today, 1), 0, business.timezone)),
        mine ? sql`${schema.appointment.staffId} = ${mine}` : undefined,
      ),
    )
    .groupBy(schema.appointment.paymentMethod);
  const takingsTotal = takings.reduce((a, r) => a + r.total, 0);
  const active = visits.filter((v) => v.status !== "no_show");
  const booked = active.reduce((t, v) => t + v.priceCents, 0);
  const upcoming = active.filter((v) => v.endMin > nowMin && v.status !== "completed");
  const earlier = visits.filter((v) => !upcoming.includes(v));
  // New salons see what's left, as one short list ("Your salon is 70% ready").
  const ready = me.role === "owner" && business.setupDone ? await readiness(business) : null;
  const gaps = sched.people.flatMap((p) => (sched.map[today]?.[p.id]?.gaps ?? []).map((g) => ({ ...g, person: p })));

  return (
    <div className="grid mx-auto w-full max-w-6xl grid-cols-1 gap-4 p-4 md:px-8 md:pt-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-x-8 lg:gap-y-6">
      <header className="flex items-center gap-3 md:hidden">
        <Logo name={business.name} logo={business.logo} size={48} />
        <div>
          <p className="font-display text-lg leading-tight font-semibold">{business.name}</p>
          <p className="text-sm text-muted">{dayLabel(today, locale)}</p>
        </div>
      </header>
      <h1 className="hidden text-[28px] leading-9 font-semibold md:block lg:col-span-2">{dayLabel(today, locale)}</h1>

      {/* Phone: one column in the order below. Computer: the day on the left, what needs you on the right. */}
      <div className="contents lg:grid lg:gap-6">
        <div className="order-1 grid gap-4 empty:hidden lg:order-none">
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-2xl font-semibold">{active.length}</p>
          <p className="text-sm text-muted">{t("visits", { count: active.length })}</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-semibold">{money(booked, business.currency, locale)}</p>
          <p className="text-sm text-muted">{t("booked")}</p>
        </div>
      </div>
        </div>
        <div className="order-7 grid gap-4 empty:hidden lg:order-none">
      <section>
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">{t("upNext")}</h2>
        {upcoming.length === 0 ? (
          <p className="card p-6 text-center text-muted">{t("nothing")}</p>
        ) : (
          <div className="card divide-y divide-line">
            {upcoming.map((v) => (
              <VisitRow key={v.id} v={v} locale={locale} showStaff={sched.people.length > 1} />
            ))}
          </div>
        )}
      </section>
        </div>
        <div className="order-10 grid gap-4 empty:hidden lg:order-none">
      {earlier.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">{t("later")}</h2>
          <div className="card divide-y divide-line opacity-70">
            {earlier.map((v) => (
              <VisitRow key={v.id} v={v} locale={locale} showStaff={sched.people.length > 1} />
            ))}
          </div>
        </section>
      )}
        </div>
      </div>
      <aside className="contents lg:grid lg:gap-4">
        <div className="order-5 grid gap-4 empty:hidden lg:order-none">
      <div className="grid grid-cols-3 gap-2 whitespace-nowrap [&>a]:px-2 [&>a]:text-[13px] md:[&>a]:text-[14px]">
        {/* On a computer New booking and Block time sit in the top bar, always one click away. */}
        <Link href={`/${locale}/admin/new`} className="btn-primary px-2 md:hidden">
          + {t("newBooking")}
        </Link>
        <Link href={`/${locale}/admin/new?walkin=1`} className="btn-ghost px-2">
          {tw("button")}
        </Link>
        <Link href={`/${locale}/admin/block`} className="btn-ghost px-2 md:hidden">
          {t("blockTime")}
        </Link>
        <Link href={`/${locale}/admin/off`} className="btn-ghost col-span-3 md:col-span-1">
          {managesAllVisits(me) ? tab("someoneOff") : tab("cantCome")}
        </Link>
      </div>
        </div>
        <div className="order-6 grid gap-4 empty:hidden lg:order-none">
      {/* Takings: with money access, or a person's own (front desk sees bookings, not money). */}
      {(allows(me, "money", "view") || !managesAllVisits(me)) && (
        <section className="card p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">{tcash("title")}</h2>
            <span className="text-xl font-semibold">{money(takingsTotal, business.currency, locale)}</span>
          </div>
          {takings.length === 0 ? (
            <p className="mt-1 text-sm text-muted">{tcash("none")}</p>
          ) : (
            <p className="mt-1 text-sm text-muted">
              {takings.map((r) => `${tco(`methods.${r.method ?? "other"}`)} ${money(r.total, business.currency, locale)}`).join(" · ")}
            </p>
          )}
        </section>
      )}
        </div>
        <div className="order-8 grid gap-4 empty:hidden lg:order-none">
      <section>
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">{t("free")}</h2>
        {gaps.length === 0 ? (
          <p className="text-sm text-muted">{t("freeNone")}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {gaps.map((g, i) => (
              <Link
                key={i}
                href={`/${locale}/admin/new?day=${today}&staff=${g.person.id}`}
                className="chip border border-line bg-white py-1.5 text-sm font-medium"
              >
                {hhmm(g.start)}–{hhmm(g.end)}
                {sched.people.length > 1 && ` · ${g.person.name}`}
              </Link>
            ))}
          </div>
        )}
      </section>
        </div>
        <div className="order-3 grid gap-4 empty:hidden lg:order-none">
      {/* Setup left: one slim row on a phone; on a computer it sits in the side menu. */}
      {ready && ready.percent < 100 && <SetupBlock setup={{ percent: ready.percent, items: ready.items }} locale={locale} className="md:hidden" />}
        </div>
      </aside>
    </div>
  );
}

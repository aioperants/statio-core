import Link from "next/link";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Field, PageHeader, SubmitButton } from "@/components/admin/ui";
import { STATUS_STYLE } from "@/components/admin/visit-row";
import { db, schema } from "@/db";
import { canEditClient, canSeeClient, pageMember } from "@/lib/access";
import { allows } from "@/lib/permissions";
import { requireBusiness } from "@/lib/booking";
import { PhoneInput } from "@/components/phone-input";
import { formatPhone } from "@/lib/phone";
import { ClientTools } from "./client-tools";
import { heardLabel } from "@/lib/heard";
import { birthdayIn, clientRhythm, everyWeeks, LEARN_AFTER } from "@/lib/client-rhythm";
import { dayLabel, hhmm, money, serviceName } from "@/lib/format";
import { waLink, whatsappBirthdayText } from "@/lib/notify";
import { todayIn, utcToLocal, weekdayOf } from "@/lib/time";
import { addClientNote, deleteClientNote, saveClient, setClientRhythm } from "../../_actions/clients";
import { Cake } from "@/components/icons";

export default async function ClientPage({ params, searchParams }: PageProps<"/[locale]/admin/clients/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("admin.clients");
  const ts = await getTranslations("status");
  const tc = await getTranslations("common");
  const th = await getTranslations("heard");
  const tcc = await getTranslations("admin.colourCard");
  const tm = await getTranslations("admin.messages");
  const tct = await getTranslations("admin.clientTools");
  const me = await pageMember(locale);
  const business = await requireBusiness();
  const isNew = id === "new";
  const client = isNew ? null : /^[0-9a-f-]{36}$/.test(id) ? await db.query.client.findFirst({ where: and(eq(schema.client.id, id), eq(schema.client.guest, false), isNull(schema.client.erasedAt)) }) : null;
  if (!isNew && (!client || !canSeeClient(me, client))) notFound();
  // Reading is for anyone who can see the client; changing needs client edit access (or it's their own client).
  const canEdit = client ? canEditClient(me, client) : allows(me, "clients", "edit");
  if (isNew && !canEdit) notFound();
  // Messages to the client (not the salon's own alerts), newest first.
  const messages = client
    ? (
        await db.query.messageLog.findMany({
          // Emails only: those are real records of what was sent.
          where: and(eq(schema.messageLog.clientId, client.id), eq(schema.messageLog.channel, "email")),
          orderBy: desc(schema.messageLog.sentAt),
          limit: 50,
        })
      ).filter((m) => !/^(owner_|staff_|magic_link)/.test(m.template))
    : [];
  // Owners and managers: other clients that look like the same person (name, phone or email).
  const full = allows(me, "clients", "full");
  const digits = (client?.phone ?? "").replace(/\D/g, "").slice(-9);
  const lookalikes =
    client && full
      ? (
          await db.execute<{ id: string; name: string; phone: string | null; email: string | null }>(sql`
            select id, name, phone, email from client
            where id <> ${client.id} and not guest and erased_at is null
              and (lower(name) = lower(${client.name})
                ${digits.length >= 6 ? sql`or right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 9) = ${digits}` : sql``}
                ${client.email ? sql`or lower(email) = lower(${client.email})` : sql``})
            limit 5
          `)
        ).rows
      : [];
  const visits = client
    ? await db.query.appointment.findMany({
        where: eq(schema.appointment.clientId, client.id),
        with: { staff: true, lines: { with: { service: true } } },
        orderBy: desc(schema.appointment.startsAt),
        limit: 50,
      })
    : [];
  const spent = visits.filter((v) => v.status === "completed").reduce((t, v) => t + v.priceCents, 0);
  const now = new Date();
  const today = todayIn(business.timezone);
  const notes = client
    ? await db.query.clientNote.findMany({ where: eq(schema.clientNote.clientId, client.id), with: { staff: { columns: { name: true } } }, orderBy: desc(schema.clientNote.createdAt), limit: 100 })
    : [];
  // Who they usually see and what they usually have, from their completed visits.
  const done = visits.filter((v) => v.status === "completed");
  // When they're likely back: their own setting, the professional's choice, what we learned, or the service standard.
  const local = (d: Date) => utcToLocal(d, business.timezone).day;
  const upcoming = visits.filter((v) => (v.status === "confirmed" || v.status === "pending") && v.startsAt > new Date()).sort((a, b) => +a.startsAt - +b.startsAt)[0];
  const rhythm = client
    ? clientRhythm({
        today,
        created: local(client.createdAt),
        visits: [...done].reverse().map((v) => {
          const lines = [...v.lines].sort((a, b) => +a.startsAt - +b.startsAt);
          return { day: local(v.startsAt), group: lines[0]?.service.categoryId ?? null, chosen: v.rebookDays, standard: Math.max(0, ...lines.map((l) => l.service.rebookDays ?? 0)) || null };
        }),
        rhythmDays: client.rhythmDays,
        nextBooked: upcoming ? local(upcoming.startsAt) : null,
      })
    : null;
  const most = <T,>(items: T[], key: (x: T) => string) => {
    const n = new Map<string, { item: T; count: number }>();
    for (const x of items) n.set(key(x), { item: x, count: (n.get(key(x))?.count ?? 0) + 1 });
    return [...n.values()].sort((a, b) => b.count - a.count)[0]?.item ?? null;
  };
  const usualStaff = most(done, (v) => v.staffId)?.staff.name;
  const usualService = most(done.flatMap((v) => v.lines), (l) => l.serviceId)?.service;
  const cancelled = visits.filter((v) => v.status === "cancelled").length;
  // Their preferred day and time of day, once a pattern shows (3+ visits, at least half alike).
  const slotOf = (v: (typeof done)[number]) => {
    const l = utcToLocal(v.startsAt, business.timezone);
    return `${weekdayOf(l.day)}-${l.minutes < 12 * 60 ? "morning" : l.minutes < 17 * 60 ? "afternoon" : "evening"}`;
  };
  const counts = new Map<string, number>();
  for (const v of done) counts.set(slotOf(v), (counts.get(slotOf(v)) ?? 0) + 1);
  const [prefKey, prefN] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  const preferred =
    done.length >= 3 && prefN / done.length >= 0.5
      ? t("prefers", {
          day: new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + Number(prefKey.split("-")[0])))),
          part: t(`parts.${prefKey.split("-")[1] as "morning"}`),
        })
      : null;
  const birthdaySoon = client ? birthdayIn(client.birthday, today) : null;
  const greeting = client?.phone && birthdaySoon !== null ? waLink(client.phone, await whatsappBirthdayText(client)) : null;
  const [bMonth, bDay] = client?.birthday?.split("-") ?? ["", ""];
  const monthName = (m: number) => new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, m - 1, 1)));

  return (
    <div>
      <PageHeader help={`/${locale}/admin/help#dueBack`}
        title={client?.name ?? t("add")}
        back={`/${locale}/admin/clients`}
        action={
          client && (
            <Link href={`/${locale}/admin/new?client=${client.id}`} className="btn-primary min-h-9 px-3 py-1.5 text-sm">
              + {t("book")}
            </Link>
          )
        }
      />
      <div className="grid grid-cols-1 mx-auto w-full max-w-6xl gap-4 p-4 md:px-8">
        {client && (
          <div className={`grid gap-2 text-center ${allows(me, "money", "view") ? "grid-cols-3" : "grid-cols-2"}`}>
            <div className="card p-3">
              <p className="text-lg font-semibold">{visits.filter((v) => v.status === "completed").length}</p>
              <p className="text-xs text-muted">{t("history")}</p>
            </div>
            {allows(me, "money", "view") && (
              <div className="card p-3">
                <p className="text-lg font-semibold">{money(spent, business.currency, locale)}</p>
                <p className="text-xs text-muted">{t("spent")}</p>
              </div>
            )}
            <div className="card p-3">
              <p className={`text-lg font-semibold ${client.noShowCount ? "text-red-700" : ""}`}>{client.noShowCount}</p>
              <p className="text-xs text-muted">{t("noShows")}</p>
              {cancelled > 0 && <p className="text-xs text-muted">{t("cancelledCount", { count: cancelled })}</p>}
            </div>
          </div>
        )}
        {client && (usualStaff || usualService) && (
          <p className="text-sm text-muted">
            {t("usually")}: <span className="font-medium text-ink">{[usualStaff, usualService && serviceName(usualService, locale), preferred].filter(Boolean).join(" · ")}</span>
          </p>
        )}
        {client && rhythm && (
          <section className="card grid gap-2 p-4">
            <div className="flex items-center gap-2">
              <h2 className="flex-1 font-semibold">{t("nextVisit")}</h2>
              <span className={`chip ${{ overdue: "bg-amber-100 text-amber-900", dueSoon: "bg-sky-100 text-sky-900", booked: "bg-emerald-100 text-emerald-800", regular: "bg-canvas text-muted", new: "bg-brand-soft text-brand" }[rhythm.state]}`}>
                {t(`state.${rhythm.state}`)}
              </span>
            </div>
            <p className="text-sm">
              {upcoming
                ? t("nextBookedOn", { day: dayLabel(local(upcoming.startsAt), locale, "short") })
                : rhythm.nextDue
                  ? t("dueAround", { day: dayLabel(rhythm.nextDue, locale, "short") })
                  : t("noEstimate")}
            </p>
            {rhythm.everyDays && (
              <p className="text-sm text-muted">
                {t("comesEvery", { weeks: everyWeeks(rhythm.everyDays) })} · {t(`source.${rhythm.source!}`, { count: rhythm.learnedFrom })}
              </p>
            )}
            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-brand">{t("howWorked")}</summary>
              <ol className="mt-2 grid gap-1 pl-1">
                {(["client", "professional", "learned", "standard"] as const).map((k, i) => (
                  <li key={k} className={rhythm.source === k ? "font-medium" : "text-muted"}>
                    {i + 1}. {t(`howSteps.${k}`, { count: LEARN_AFTER })} {rhythm.source === k && "←"}
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-muted">{t("howDue")}</p>
            </details>
            {canEdit && (
              <form action={setClientRhythm.bind(null, client.id)} className="mt-1 flex flex-wrap items-end gap-2">
                <label className="grow">
                  <span className="label">{t("setRhythm")}</span>
                  <input name="weeks" type="number" min={1} max={52} placeholder={t("auto")} defaultValue={client.rhythmDays ? Math.round(client.rhythmDays / 7) : ""} className="field" />
                </label>
                <SubmitButton className="btn-ghost min-h-11 px-4">{tc("save")}</SubmitButton>
              </form>
            )}
          </section>
        )}
        {birthdaySoon !== null && (
          <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <span className="flex-1"><Cake className="inline size-4 align-[-3px]" /> {t("birthdayIn", { days: birthdaySoon })}</span>
            {greeting && (
              <a href={greeting} className="btn-ghost min-h-9 border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800" target="_blank" rel="noreferrer">
                {t("congratulate")}
              </a>
            )}
          </div>
        )}
        {client?.phone && (
          <div className="grid grid-cols-2 gap-2">
            <a className="btn-ghost" href={`tel:${client.phone.replace(/[^\d+]/g, "")}`}>
              {formatPhone(client.phone)}
            </a>
            <a className="btn-ghost" href={`https://wa.me/${client.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          </div>
        )}

        <form action={saveClient.bind(null, locale)} className="card grid gap-4 p-4">
          {!canEdit && <p className="rounded-xl bg-canvas p-3 text-sm text-muted">{t("viewOnly")}</p>}
          <fieldset disabled={!canEdit} className="grid gap-4">
          {sp.error === "duplicate" && <p className="text-sm text-red-700">{t("duplicate")}</p>}
          {sp.merged && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">✓ {tct("merged")}</p>}
          <input type="hidden" name="id" value={client?.id ?? ""} />
          <Field label={t("name")}>
            <input name="name" required className="field" defaultValue={client?.name ?? ""} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("phone")}>
              <PhoneInput name="phone" defaultValue={client?.phone} country={business.country} locale={locale} />
            </Field>
            <Field label={t("email")}>
              <input name="email" type="email" className="field" defaultValue={client?.email ?? ""} />
            </Field>
          </div>
          <Field label={t("birthday")}>
            <div className="grid grid-cols-[5rem_1fr] gap-2">
              <select name="birthDay" className="field" defaultValue={bDay ? String(Number(bDay)) : ""} aria-label={t("birthdayDay")}>
                <option value="">—</option>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
              <select name="birthMonth" className="field" defaultValue={bMonth ? String(Number(bMonth)) : ""} aria-label={t("birthdayMonth")}>
                <option value="">—</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {monthName(i + 1)}
                  </option>
                ))}
              </select>
            </div>
          </Field>
          {/* Answers to the first-booking questions; the team can fill them in too. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={th("question")}>
              <select name="heardFrom" className="field" defaultValue={client?.heardFrom ?? ""}>
                <option value="">—</option>
                {[...new Set([...business.heardOptions, ...(client?.heardFrom ? [client.heardFrom] : [])])].map((o) => (
                  <option key={o} value={o}>
                    {heardLabel(o, th)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={th("who")} hint={th("whoHint")}>
              <input name="recommendedBy" maxLength={120} className="field" defaultValue={client?.recommendedBy ?? ""} />
            </Field>
          </div>
          <Field label={th("city")} hint={th("cityHint")}>
            <input name="city" maxLength={80} className="field" defaultValue={client?.city ?? ""} />
          </Field>
          <Field label={t("keepInMind")} hint={t("notesHint")}>
            <textarea name="notes" rows={2} className="field" defaultValue={client?.notes ?? ""} />
          </Field>
          <Field label={t("tags")} hint={t("tagsHint")}>
            <input name="tags" className="field" defaultValue={client?.tags.join(", ") ?? ""} />
          </Field>
          {allows(me, "clients", "full") && (
            <Field label={t("statusLabel")}>
              <select name="status" className="field" defaultValue={client?.status ?? "active"}>
                {(["active", "needs_approval", "blocked"] as const).map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          </fieldset>
          {canEdit && <SubmitButton>{tc("save")}</SubmitButton>}
        </form>

        {client && (
          <section className="grid gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">{t("notesLog")}</h2>
            <form action={addClientNote.bind(null, client.id)} className="card grid gap-2 p-3">
              <textarea name="text" rows={2} required maxLength={2000} className="field" placeholder={t("notePlaceholder")} />
              <SubmitButton className="btn-ghost min-h-10 justify-self-end px-4">+ {t("addNote")}</SubmitButton>
            </form>
            {notes.length > 0 && (
              <ul className="card divide-y divide-line">
                {notes.map((n) => {
                  const l = utcToLocal(n.createdAt, business.timezone);
                  return (
                    <li key={n.id} className="flex gap-3 p-3.5">
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-muted">
                          {dayLabel(l.day, locale, "short")}
                          {n.staff && ` · ${n.staff.name}`}
                        </span>
                        <span className="block text-sm whitespace-pre-line">{n.text}</span>
                      </span>
                      {(allows(me, "clients", "full") || n.staffId === me.id) && (
                        <form action={deleteClientNote.bind(null, n.id)}>
                          <ConfirmButton message={t("deleteNote")} className="text-sm text-muted hover:text-red-700">
                            ✕
                          </ConfirmButton>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {client && full && <ClientTools locale={locale} id={client.id} name={client.name} suggestions={lookalikes} />}

        {/* Every message the client got from the salon: emails, and WhatsApp/SMS opened from the app. */}
        {messages.length > 0 && (
          <details className="card p-3 text-sm">
            <summary className="cursor-pointer font-semibold">{tm("title", { count: messages.length })}</summary>
            <ul className="mt-2 divide-y divide-line">
              {messages.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2">
                  <span className="w-20 shrink-0 text-xs text-muted">{dayLabel(utcToLocal(m.sentAt, business.timezone).day, locale, "short")}</span>
                  <span className="min-w-0 flex-1">{tm.has(`templates.${m.template}`) ? tm(`templates.${m.template}` as "templates.reminder") : m.template}</span>
                  {m.status.startsWith("failed") && <span className="chip shrink-0 bg-red-100 text-red-700">{tm("failed")}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}

        {/* Colour cards: the formulas used, newest first, to repeat them. */}
        {visits.some((v) => v.formula) && (
          <section>
            <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">{tcc("history")}</h2>
            <ul className="card divide-y divide-line text-sm">
              {visits
                .filter((v) => v.formula)
                .slice(0, 6)
                .map((v) => (
                  <li key={v.id} className="grid gap-0.5 p-3">
                    <span className="text-xs text-muted">
                      {dayLabel(utcToLocal(v.startsAt, business.timezone).day, locale, "short")} · {v.staff.name}
                    </span>
                    <span className="whitespace-pre-line">{v.formula}</span>
                  </li>
                ))}
            </ul>
          </section>
        )}

        {visits.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">{t("history")}</h2>
            <ul className="card divide-y divide-line">
              {visits.map((v) => {
                const l = utcToLocal(v.startsAt, business.timezone);
                return (
                  <li key={v.id}>
                    <Link href={`/${locale}/admin/visit/${v.id}`} className="flex items-center gap-3 p-3.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{v.lines.map((x) => serviceName(x.service, locale)).join(" + ")}</span>
                        <span className="block text-sm text-muted">
                          {dayLabel(l.day, locale, "short")} {hhmm(l.minutes)} · {v.staff.name} · {money(v.priceCents, business.currency, locale)}
                        </span>
                      </span>
                      <span className={`chip ${v.startsAt > now && v.status === "confirmed" ? "bg-brand-soft text-brand" : STATUS_STYLE[v.status]}`}>
                        {v.startsAt > now && v.status === "confirmed" ? t("upcoming") : ts(v.status)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

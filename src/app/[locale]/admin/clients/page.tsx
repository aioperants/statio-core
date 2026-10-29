import Link from "next/link";
import { formatPhone } from "@/lib/phone";
import { sql } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Empty, PageHeader } from "@/components/admin/ui";
import { db } from "@/db";
import { pageMember } from "@/lib/access";
import { allows } from "@/lib/permissions";
import { requireBusiness } from "@/lib/booking";
import { heardLabel } from "@/lib/heard";
import { birthdayIn, clientRhythm, everyWeeks, type RhythmState } from "@/lib/client-rhythm";
import { dayLabel, money, serviceName } from "@/lib/format";
import { waLink, whatsappBirthdayText, whatsappComeBackText } from "@/lib/notify";
import { todayIn, utcToLocal } from "@/lib/time";
import { Bell, Cake, User } from "@/components/icons";

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

const SORTS = ["due", "last", "visits", "since", "spent", "name"] as const;
type Sort = (typeof SORTS)[number];
const FILTERS = ["all", "overdue", "dueSoon", "new", "regular", "birthdays"] as const;
type Filter = (typeof FILTERS)[number];

/** Status chip colours: overdue stands out, the rest stays calm. */
const CHIP: Record<RhythmState, string> = {
  overdue: "bg-amber-100 text-amber-900",
  dueSoon: "bg-sky-100 text-sky-900",
  booked: "bg-emerald-100 text-emerald-800",
  regular: "bg-canvas text-muted",
  new: "bg-brand-soft text-brand",
};

export default async function ClientsPage({ params, searchParams }: PageProps<"/[locale]/admin/clients">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("admin.clients");
  const me = await pageMember(locale);
  const business = await requireBusiness();
  const today = todayIn(business.timezone);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  // What each client has spent is money: only for people with money access.
  const money_ = allows(me, "money", "view");
  const sort: Sort = SORTS.includes(sp.sort as Sort) && (sp.sort !== "spent" || money_) ? (sp.sort as Sort) : "due";
  const filter: Filter = FILTERS.includes(sp.show as Filter) ? (sp.show as Filter) : "all";
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const digits = q.replace(/\D/g, "");

  // One row per client: completed visits, first/last visit, spend, the "comes back after" days of
  // their last visit, and their next booked visit. Staff don't see other people's own clients.
  const rows = await db.execute<{
    id: string;
    name: string;
    phone: string | null;
    locale: string | null;
    status: string;
    no_show_count: number;
    tags: string[];
    created_at: Date;
    visits: number;
    first_visit: Date | null;
    last_visit: Date | null;
    spent: number;
    rhythm_days: number | null;
    history: { day: string; grp: string | null; chosen: number | null; standard: number | null }[] | null;
    next_booked: Date | null;
    birthday: string | null;
    usual_staff: string | null;
    usual_service: { names: Record<string, string>; name_es: string } | null;
  }>(sql`
    select c.id, c.name, c.phone, c.locale, c.status, c.no_show_count, c.tags, c.created_at, c.birthday, c.rhythm_days,
      count(a.id)::int as visits,
      min(a.starts_at) as first_visit,
      max(a.starts_at) as last_visit,
      coalesce(sum(coalesce(a.paid_cents, a.price_cents)), 0)::int as spent,
      -- Their completed visits, oldest first: when, what kind (group of the first service), the
      -- "come back in" days chosen at checkout and the service's standard estimate.
      (select json_agg(json_build_object(
          'day', to_char(h.starts_at at time zone ${business.timezone}, 'YYYY-MM-DD'),
          'grp', (select s.category_id from appointment_line l join service s on s.id = l.service_id where l.appointment_id = h.id order by l.starts_at limit 1),
          'chosen', h.rebook_days,
          'standard', (select max(s.rebook_days) from appointment_line l join service s on s.id = l.service_id where l.appointment_id = h.id)
        ) order by h.starts_at)
       from appointment h where h.client_id = c.id and h.status = 'completed') as history,
      (select min(n.starts_at) from appointment n where n.client_id = c.id and n.status in ('pending', 'confirmed') and n.starts_at > now()) as next_booked,
      -- Who they usually see and what they usually have (most visits; the latest breaks a tie).
      (select s.name from appointment x join staff s on s.id = x.staff_id where x.client_id = c.id and x.status = 'completed'
         group by s.id, s.name order by count(*) desc, max(x.starts_at) desc limit 1) as usual_staff,
      (select json_build_object('names', sv.names, 'name_es', sv.name_es) from appointment x join appointment_line l on l.appointment_id = x.id join service sv on sv.id = l.service_id
         where x.client_id = c.id and x.status = 'completed' group by sv.id order by count(*) desc, max(x.starts_at) desc limit 1) as usual_service
    from client c
    left join appointment a on a.client_id = c.id and a.status = 'completed'
    where not c.guest and c.erased_at is null and ${allows(me, "clients", "full") ? sql`true` : sql`(c.owner_staff_id is null or c.owner_staff_id = ${me.id})`}
      ${q ? sql`and (c.name ilike ${like} or c.email ilike ${like} ${digits.length >= 3 ? sql`or regexp_replace(coalesce(c.phone, ''), '\\D', '', 'g') like ${`%${digits}%`}` : sql``})` : sql``}
    group by c.id
    limit 1000
  `);
  const day = (d: Date | null) => (d ? utcToLocal(new Date(d), business.timezone).day : null);
  const all = rows.rows.map((r) => ({
    ...r,
    last: day(r.last_visit),
    booked: day(r.next_booked),
    birthdayIn: birthdayIn(r.birthday, today),
    usual: [r.usual_staff, r.usual_service && serviceName({ names: r.usual_service.names, nameEs: r.usual_service.name_es, nameEn: r.usual_service.name_es }, locale)].filter(Boolean).join(" · "),
    ...clientRhythm({
      today,
      created: day(r.created_at)!,
      visits: (r.history ?? []).map((h) => ({ day: h.day, group: h.grp, chosen: h.chosen, standard: h.standard })),
      rhythmDays: r.rhythm_days,
      nextBooked: day(r.next_booked),
    }),
  }));
  const matches = (c: (typeof all)[number], f: Filter) => f === "all" || (f === "birthdays" ? c.birthdayIn !== null : c.state === f);
  const counts = Object.fromEntries(FILTERS.map((f) => [f, all.filter((c) => matches(c, f)).length])) as Record<Filter, number>;
  const by: Record<Sort, (a: (typeof all)[number], b: (typeof all)[number]) => number> = {
    // Most urgent first: overdue (longest overdue on top), due soon, then the rest by next due.
    due: (a, b) => (a.nextDue ?? "9999").localeCompare(b.nextDue ?? "9999") || a.name.localeCompare(b.name),
    last: (a, b) => (b.last ?? "").localeCompare(a.last ?? ""),
    visits: (a, b) => b.visits - a.visits,
    since: (a, b) => a.since.localeCompare(b.since),
    spent: (a, b) => b.spent - a.spent,
    name: (a, b) => a.name.localeCompare(b.name, locale),
  };
  const rank = (s: RhythmState) => ["overdue", "dueSoon", "regular", "booked", "new"].indexOf(s);
  const list = all
    .filter((c) => matches(c, filter))
    .sort((a, b) => (filter === "birthdays" ? a.birthdayIn! - b.birthdayIn! : sort === "due" ? rank(a.state) - rank(b.state) || by.due(a, b) : by[sort](a, b)))
    .slice(0, 200);
  // One tap to invite an overdue client back by WhatsApp, with the usual come-back message.
  const invite = new Map(
    await Promise.all(
      list.filter((c) => c.state === "overdue" && c.phone).map(async (c) => [c.id, waLink(c.phone, await whatsappComeBackText({ name: c.name, locale: c.locale }))] as const),
    ),
  );
  // And one tap to send birthday wishes.
  const wishes = new Map(
    await Promise.all(list.filter((c) => c.birthdayIn !== null && c.phone).map(async (c) => [c.id, waLink(c.phone, await whatsappBirthdayText(c))] as const)),
  );

  // Where new clients come from (last 90 days), their towns, and walk-in guests without a record.
  const tq = await getTranslations("heard");
  const origin = allows(me, "clients", "full")
    ? (
        await db.execute<{ heard: { k: string | null; n: number }[] | null; towns: { k: string; n: number }[] | null; total: number; guests: number }>(sql`
          with fresh as (select * from client where not guest and created_at > now() - interval '90 days')
          select
            (select count(*)::int from fresh) as total,
            (select json_agg(x order by x.n desc) from (select heard_from as k, count(*)::int as n from fresh group by heard_from) x) as heard,
            (select json_agg(x order by x.n desc) from (select initcap(trim(city)) as k, count(*)::int as n from fresh where coalesce(trim(city), '') <> '' group by 1 order by 2 desc limit 5) x) as towns,
            (select count(*)::int from appointment a join client c on c.id = a.client_id where c.guest and a.status = 'completed' and a.starts_at > now() - interval '90 days') as guests
        `)
      ).rows[0]
    : null;
  const short = (d: string | null) => (d ? dayLabel(d, locale, "short") : "—");
  // On a phone the second line needs the shortest date: "23 Sep".
  const tiny = (d: string) => new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));
  const href = (o: { sort?: Sort; show?: Filter }) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    const s = o.sort ?? sort;
    const f = o.show ?? filter;
    if (s !== "due") p.set("sort", s);
    if (f !== "all") p.set("show", f);
    const qs = p.toString();
    return `/${locale}/admin/clients${qs ? `?${qs}` : ""}`;
  };
  // How far through their cycle they are: days since the last visit against their usual interval.
  const progress = (c: (typeof list)[number]) => {
    if (c.state === "booked" || !c.last || !c.everyDays || !c.nextDue) return null;
    const pct = Math.max(0, Math.round((daysBetween(c.last, today) / c.everyDays) * 100));
    const left = daysBetween(today, c.nextDue);
    return { pct, left, text: left < 0 ? t("overdueBy", { days: -left }) : t("dueIn", { pct, days: left }) };
  };
  const bar = (c: (typeof list)[number]) => {
    const p = progress(c);
    if (!p) return null;
    const color = p.left < 0 ? "bg-amber-500" : c.state === "dueSoon" ? "bg-sky-500" : "bg-emerald-500";
    return (
      <span className="mt-1 block">
        <span className="block h-1.5 w-28 overflow-hidden rounded-full bg-line">
          <span className={`block h-full ${color}`} style={{ width: `${Math.min(100, p.pct)}%` }} />
        </span>
        <span className={`mt-0.5 block text-xs ${p.left < 0 ? "font-medium text-amber-800" : "text-muted"}`}>{p.text}</span>
      </span>
    );
  };
  // "Booked · 25 Oct" says when they're coming next, not just that they are.
  const chip = (s: RhythmState, booked: string | null) => (
    <span className={`chip whitespace-nowrap ${CHIP[s]}`}>{s === "booked" && booked ? t("bookedOn", { day: tiny(booked) }) : t(`state.${s}`)}</span>
  );
  // `links`: false inside a row that is itself a link (a link can't hold another link).
  const markers = (c: (typeof list)[number], links = true) => (
    <>
      {c.birthdayIn !== null &&
        (links || !wishes.get(c.id)) &&
        (links && wishes.get(c.id) ? (
          <a href={wishes.get(c.id)!} target="_blank" rel="noreferrer" className="chip whitespace-nowrap bg-amber-50 text-amber-900">
            <Cake className="inline size-3.5 align-[-2px]" /> {t("birthdayChip", { days: c.birthdayIn })}
          </a>
        ) : (
          <span className="chip whitespace-nowrap bg-amber-50 text-amber-900"><Cake className="inline size-3.5 align-[-2px]" /> {t("birthdayChip", { days: c.birthdayIn })}</span>
        ))}
      {c.status !== "active" && <span className="chip bg-red-100 text-red-700">{t(`status.${c.status as "blocked"}`)}</span>}
      {c.no_show_count > 0 && <span className="chip bg-red-100 text-red-700">⚠︎ {c.no_show_count}</span>}
    </>
  );
  const th = (s: Sort | null, label: string, right = false) => (
    <th className={`px-3 py-2.5 font-semibold ${right ? "text-right" : "text-left"}`}>
      {s ? (
        <Link href={href({ sort: s })} className={sort === s ? "text-brand" : "hover:text-brand"}>
          {label}
          {sort === s && " ↓"}
        </Link>
      ) : (
        label
      )}
    </th>
  );

  return (
    <div>
      <PageHeader help={`/${locale}/admin/help#clients`}
        title={t("title")}
        wide
        action={
          allows(me, "clients", "edit") && (
            <Link href={`/${locale}/admin/clients/new`} className="btn-primary min-h-9 px-3 py-1.5 text-sm">
              + {t("add")}
            </Link>
          )
        }
      />
      <div className="grid mx-auto w-full max-w-6xl grid-cols-1 gap-3 p-4 md:px-8">
        {sp.erased && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">✓ {t("erased")}</p>}
        {sp.imported && typeof sp.imported === "string" && (
          <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            {(([added, updated, skipped]) => t("importDone", { added, updated, skipped }))(sp.imported.split("-").map(Number))}
          </p>
        )}
        <form className="flex gap-2">
          <input name="q" defaultValue={q} type="search" placeholder={`${t("name")}, ${t("phone")}, ${t("email")}`} className="field" />
          {sort !== "due" && <input type="hidden" name="sort" value={sort} />}
          {filter !== "all" && <input type="hidden" name="show" value={filter} />}
        </form>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
          {FILTERS.map((f) => (
            <Link key={f} href={href({ show: f })} className={`chip shrink-0 border py-2 ${filter === f ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>
              {t(`filters.${f}`)} · {counts[f]}
            </Link>
          ))}
        </div>
        {origin && (origin.total > 0 || origin.guests > 0) && (
          <details className="card p-3 text-sm">
            <summary className="cursor-pointer font-semibold">{tq("summary", { count: origin.total })}</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <span className="text-xs text-muted uppercase">{tq("question")}</span>
                {(origin.heard ?? []).map((h) => (
                  <div key={h.k ?? "-"} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-2">
                    <span className="truncate">{h.k ? heardLabel(h.k, tq) : tq("unknown")}</span>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-line">
                      <span className={`block h-full ${h.k ? "bg-brand" : "bg-muted/40"}`} style={{ width: `${Math.round((h.n / origin.total) * 100)}%` }} />
                    </span>
                    <span className="text-right text-muted">{Math.round((h.n / origin.total) * 100)}%</span>
                  </div>
                ))}
              </div>
              <div className="grid content-start gap-1.5">
                <span className="text-xs text-muted uppercase">{tq("towns")}</span>
                {(origin.towns ?? []).length === 0 ? (
                  <span className="text-muted">—</span>
                ) : (
                  origin.towns!.map((x) => (
                    <div key={x.k} className="flex justify-between">
                      <span>{x.k}</span>
                      <span className="text-muted">{x.n}</span>
                    </div>
                  ))
                )}
                {origin.guests > 0 && <p className="mt-2 text-muted"><User className="inline size-4 align-[-3px]" /> {tq("guests", { count: origin.guests })}</p>}
              </div>
            </div>
          </details>
        )}
        {/* Phone: sort as a small menu (the table headers do it on a computer). */}
        <div className="-mx-4 flex items-center gap-3 overflow-x-auto px-4 text-sm [scrollbar-width:none] md:hidden">
          <span className="text-muted">{t("sortBy")}</span>
          {/* "Top spenders" for people who may see money. */}
          {SORTS.filter((s) => s !== "spent" || money_).map((s) => (
            <Link key={s} href={href({ sort: s })} className={`whitespace-nowrap ${sort === s ? "font-semibold text-brand" : "text-muted"}`}>
              {t(`sort.${s}`)}
            </Link>
          ))}
        </div>

        {list.length === 0 ? (
          <Empty>{q || filter !== "all" ? t("noMatch") : t("empty")}</Empty>
        ) : (
          <>
            {/* Computer: a table with sortable columns */}
            <div className="card hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-line text-xs text-muted">
                  <tr>
                    {th("name", t("col.client"))}
                    {th(null, t("col.usual"))}
                    {th("since", t("col.since"))}
                    {th("visits", t("col.visits"), true)}
                    {th("last", t("col.last"))}
                    {th(null, t("col.every"))}
                    {th("due", t("col.nextDue"))}
                    {th(null, t("col.status"))}
                    {money_ && th("spent", t("col.spent"), true)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.map((c) => (
                    <tr key={c.id} className="hover:bg-canvas">
                      <td className="px-3 py-2.5">
                        <Link href={`/${locale}/admin/clients/${c.id}`} className="block font-medium hover:text-brand">
                          {c.name}
                        </Link>
                        <span className="text-xs text-muted">{[formatPhone(c.phone), ...c.tags].filter(Boolean).join(" · ")}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs">{c.usual || "—"}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{short(c.since)}</td>
                      <td className="px-3 py-2.5 text-right">{c.visits}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{short(c.last)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {c.everyDays ? t("everyWeeks", { weeks: everyWeeks(c.everyDays) }) : "—"}
                        {c.source && <span className="block text-xs text-muted">{t(`source.${c.source}`, { count: c.learnedFrom })}</span>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {c.state === "booked" ? <span className="font-medium text-emerald-800">{short(c.booked)}</span> : short(c.nextDue)}
                        {bar(c)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="flex flex-wrap items-center gap-1">
                          {chip(c.state, c.booked)}
                          {markers(c)}
                          {invite.get(c.id) && (
                            <a href={invite.get(c.id)!} target="_blank" rel="noreferrer" className="chip border border-emerald-200 bg-emerald-50 text-emerald-800">
                              {t("inviteBack")}
                            </a>
                          )}
                        </span>
                      </td>
                      {money_ && <td className="px-3 py-2.5 text-right whitespace-nowrap">{money(c.spent, business.currency, locale)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone: one row per client, the same facts in a second line */}
            <ul className="card divide-y divide-line md:hidden">
              {list.map((c) => (
                <li key={c.id} className="flex items-center gap-3 p-3.5">
                  <Link href={`/${locale}/admin/clients/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 active:opacity-70">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand">{c.name[0]?.toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-medium">{c.name}</span>
                        {c.state !== "regular" && !invite.get(c.id) && chip(c.state, c.booked)}
                        {markers(c, false)}
                      </span>
                      <span className="block truncate text-sm text-muted">
                        {[
                          // Sorted by spending: the amount comes first, so it's never cut off.
                          money_ && sort === "spent" && c.spent > 0 && money(c.spent, business.currency, locale),
                          c.everyDays && t("everyWeeks", { weeks: everyWeeks(c.everyDays) }),
                          progress(c)?.text ?? (c.last ? t("lastShort", { day: tiny(c.last) }) : t("never")),
                          c.visits > 0 && t("visits", { count: c.visits }),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </Link>
                  {invite.get(c.id) ? (
                    <a href={invite.get(c.id)!} target="_blank" rel="noreferrer" className="chip shrink-0 border border-amber-200 bg-amber-100 text-amber-900">
                      <Bell className="inline size-4 align-[-3px]" /> {t("inviteBack")}
                    </a>
                  ) : (
                    wishes.get(c.id) && (
                      <a href={wishes.get(c.id)!} target="_blank" rel="noreferrer" className="chip shrink-0 border border-emerald-200 bg-emerald-50 text-emerald-800">
                        <Cake className="inline size-4 align-[-3px]" /> {t("congratulate")}
                      </a>
                    )
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="text-sm text-muted">{t("count", { count: list.length })}</p>
        {/* Importing and downloading the client list: the owner, or whoever they allow. */}
        {allows(me, "clientData", "view") && (
          <div className="grid grid-cols-2 gap-2 md:max-w-md">
            {allows(me, "clientData", "edit") && (
              <Link href={`/${locale}/admin/clients/import`} className="btn-ghost">
                {t("import")}
              </Link>
            )}
            <a href="/api/export/clients" className="btn-ghost">
              {t("export")}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

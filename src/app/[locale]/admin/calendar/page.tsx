import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { STATUS_STYLE, VisitRow } from "@/components/admin/visit-row";
import { pageMember, seesAllVisits } from "@/lib/access";
import { dayAppointments, requireBusiness } from "@/lib/booking";
import { dayLabel, hhmm, serviceName } from "@/lib/format";
import { schedule } from "@/lib/schedule";
import { addDays, isValidDay, todayIn, utcToLocal, weekdayOf } from "@/lib/time";
import { DatePicker } from "./date-picker";

const PX = 1.1; // pixels per minute

/** Side-by-side lanes for visits that overlap (walk-ins squeezed in on purpose). */
function lanes<T extends { startMin: number; endMin: number }>(items: T[]) {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin);
  const out: { item: T; lane: number; of: number }[] = [];
  let cluster: { item: T; lane: number; of: number }[] = [];
  let clusterEnd = -1;
  const close = () => {
    const n = Math.max(1, ...cluster.map((c) => c.lane + 1));
    cluster.forEach((c) => (c.of = n));
    out.push(...cluster);
    cluster = [];
  };
  for (const item of sorted) {
    if (item.startMin >= clusterEnd && cluster.length) close();
    const used = cluster.filter((c) => c.item.endMin > item.startMin).map((c) => c.lane);
    let lane = 0;
    while (used.includes(lane)) lane++;
    cluster.push({ item, lane, of: 1 });
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  if (cluster.length) close();
  return out;
}

export default async function CalendarPage({ params, searchParams }: PageProps<"/[locale]/admin/calendar">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("admin.calendar");
  const tc = await getTranslations("common");
  const me = await pageMember(locale);
  const business = await requireBusiness();
  const today = todayIn(business.timezone);
  const view = sp.view === "week" ? "week" : "day";
  let day = typeof sp.day === "string" && isValidDay(sp.day) ? sp.day : today;
  if (view === "week") day = addDays(day, -weekdayOf(day));
  const staffParam = !seesAllVisits(me) ? me.id : typeof sp.staff === "string" ? sp.staff : undefined;
  const span = view === "week" ? 7 : 1;

  const [sched, visits] = await Promise.all([schedule(day, span, { staffId: staffParam }), dayAppointments(day, { staffId: staffParam, days: span })]);
  const allPeople = !seesAllVisits(me) ? sched.people : (await schedule(day, 1)).people;
  // On the day view, leave out people who aren't working and have nothing booked.
  const working = sched.people.filter((p) => sched.map[day]?.[p.id]?.hours.length || visits.some((v) => v.staffId === p.id));
  const people = view === "day" && !staffParam && working.length ? working : sched.people;

  const href = (o: { day?: string; view?: string; staff?: string | null }) => {
    const q = new URLSearchParams();
    q.set("day", o.day ?? day);
    if ((o.view ?? view) === "week") q.set("view", "week");
    const s = o.staff === undefined ? staffParam : o.staff;
    if (s && seesAllVisits(me)) q.set("staff", s);
    return `/${locale}/admin/calendar?${q}`;
  };

  // Visible hours: everyone's working hours, widened to fit any visit.
  const dayData = sched.map[day] ?? {};
  const starts = [...Object.values(dayData).flatMap((d) => d.hours.map((h) => h.start)), ...visits.map((v) => v.startMin)];
  const ends = [...Object.values(dayData).flatMap((d) => d.hours.map((h) => h.end)), ...visits.map((v) => v.endMin)];
  const top = Math.floor((starts.length ? Math.min(...starts) : 540) / 60) * 60;
  const bottom = Math.ceil((ends.length ? Math.max(...ends) : 1140) / 60) * 60;
  const nowLocal = utcToLocal(new Date(), business.timezone);

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/95 px-4 py-2 backdrop-blur md:px-8 md:pt-6">
        <div className="flex items-center gap-1">
          <Link href={href({ day: addDays(day, -span) })} className="flex size-10 items-center justify-center rounded-full text-xl" aria-label="Previous">
            ‹
          </Link>
          <DatePicker value={day} label={view === "week" ? `${dayLabel(day, locale, "short")} – ${dayLabel(addDays(day, 6), locale, "short")}` : dayLabel(day, locale)} base={href({})} />
          <Link href={href({ day: addDays(day, span) })} className="flex size-10 items-center justify-center rounded-full text-xl" aria-label="Next">
            ›
          </Link>
          <span className="flex-1" />
          {day !== today && (
            <Link href={href({ day: today })} className="chip border border-line bg-white py-1.5">
              {tc("today")}
            </Link>
          )}
          <div className="ml-1 flex rounded-full border border-line bg-white p-0.5 text-sm font-medium">
            <Link href={href({ view: "day" })} className={`rounded-full px-3 py-1 ${view === "day" ? "bg-brand text-white" : ""}`}>
              1
            </Link>
            <Link href={href({ view: "week" })} className={`rounded-full px-3 py-1 ${view === "week" ? "bg-brand text-white" : ""}`}>
              7
            </Link>
          </div>
        </div>
        {seesAllVisits(me) && allPeople.length > 1 && (
          <div className="-mx-4 mt-1 flex gap-2 overflow-x-auto px-4 pb-1">
            <Link href={href({ staff: null })} className={`chip shrink-0 border py-1.5 ${!staffParam ? "border-brand bg-brand text-white" : "border-line bg-white"}`}>
              {t("everyone")}
            </Link>
            {allPeople.map((p) => (
              <Link
                key={p.id}
                href={href({ staff: p.id })}
                className={`chip shrink-0 border py-1.5 ${staffParam === p.id ? "border-brand bg-brand text-white" : "border-line bg-white"}`}
              >
                <span style={{ background: p.color }} className="mr-1.5 size-2.5 rounded-full" />
                {p.name}
              </Link>
            ))}
          </div>
        )}
      </header>

      {view === "week" ? (
        <div className="grid grid-cols-1 mx-auto w-full max-w-6xl gap-4 p-4 md:px-8">
          {sched.days.map((d) => {
            const list = visits.filter((v) => v.day === d);
            return (
              <section key={d}>
                <Link href={href({ day: d, view: "day" })} className="mb-2 flex items-baseline gap-2">
                  <h2 className={`font-semibold ${d === today ? "text-brand" : ""}`}>{dayLabel(d, locale)}</h2>
                  <span className="text-sm text-muted">{list.length || ""}</span>
                </Link>
                {list.length === 0 ? (
                  <p className="text-sm text-muted">
                    {people.every((p) => !sched.map[d][p.id].hours.length) ? t("off") : t("empty")}
                  </p>
                ) : (
                  <div className="card divide-y divide-line">
                    {list.map((v) => (
                      <VisitRow key={v.id} v={v} locale={locale} showStaff={people.length > 1} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto px-2 py-3 md:px-8">
          <div className="flex min-w-full" style={{ height: (bottom - top) * PX + 28 }}>
            <div className="sticky left-0 z-[5] w-11 shrink-0 bg-canvas pt-7">
              {Array.from({ length: (bottom - top) / 60 + 1 }, (_, i) => (
                <div key={i} style={{ top: i * 60 * PX }} className="relative h-0 -translate-y-2 pr-1.5 text-right text-xs text-muted">
                  {hhmm(top + i * 60)}
                </div>
              ))}
            </div>
            {people.map((p) => {
              const d = dayData[p.id];
              const list = visits.filter((v) => v.staffId === p.id);
              return (
                <div key={p.id} className="min-w-[150px] flex-1 border-l border-line">
                  <div className="flex h-7 items-center justify-center gap-1.5 truncate text-sm font-semibold">
                    <span style={{ background: p.color }} className="size-2.5 rounded-full" />
                    {p.name}
                  </div>
                  <div className="relative bg-gray-100/70" style={{ height: (bottom - top) * PX }}>
                    {d.hours.map((h, i) => (
                      <div key={i} className="absolute inset-x-0 bg-white" style={{ top: (h.start - top) * PX, height: (h.end - h.start) * PX }} />
                    ))}
                    {Array.from({ length: (bottom - top) / 60 }, (_, i) => (
                      <div key={i} className="absolute inset-x-0 border-t border-line/70" style={{ top: i * 60 * PX }} />
                    ))}
                    {d.blocks.map((b) => (
                      <div
                        key={b.id}
                        className="absolute inset-x-1 overflow-hidden rounded-lg border border-gray-300 bg-[repeating-linear-gradient(45deg,#f3f1f4,#f3f1f4_6px,#e8e4ea_6px,#e8e4ea_12px)] p-1 text-xs text-muted"
                        style={{ top: (Math.max(b.start, top) - top) * PX, height: (Math.min(b.end, bottom) - Math.max(b.start, top)) * PX }}
                      >
                        {b.salon ? t("closed") : b.reason || t("blocked")}
                      </div>
                    ))}
                    {lanes(list).map(({ item: v, lane, of }) => (
                      <Link
                        key={v.id}
                        href={`/${locale}/admin/visit/${v.id}`}
                        style={{
                          top: (v.startMin - top) * PX + 1,
                          height: Math.max((v.endMin - v.startMin) * PX - 2, 22),
                          background: p.color,
                          left: `calc(${(lane / of) * 100}% + 4px)`,
                          width: `calc(${100 / of}% - 8px)`,
                        }}
                        className={`absolute overflow-hidden rounded-lg px-1.5 py-1 text-xs leading-tight shadow-sm ${v.status === "pending" ? "border-2 border-dashed border-amber-500" : ""} ${v.status === "no_show" || v.status === "completed" ? "opacity-60" : ""}`}
                      >
                        <span className="font-semibold">{hhmm(v.startMin)}</span> {v.bookedForName || v.client.name}
                        <span className="block truncate text-[11px] opacity-80">{v.lines.map((l) => serviceName(l.service, locale)).join(" + ")}</span>
                        {v.status !== "confirmed" && <span className={`chip mt-0.5 px-1.5 text-[10px] ${STATUS_STYLE[v.status]}`}>{v.status === "pending" ? "?" : "·"}</span>}
                      </Link>
                    ))}
                    {day === nowLocal.day && nowLocal.minutes > top && nowLocal.minutes < bottom && (
                      <div className="absolute inset-x-0 z-[4] border-t-2 border-red-500" style={{ top: (nowLocal.minutes - top) * PX }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Link
        href={`/${locale}/admin/new?day=${day}${staffParam ? `&staff=${staffParam}` : ""}`}
        className="fixed right-4 bottom-24 z-20 flex size-14 items-center justify-center rounded-full bg-brand text-3xl text-white shadow-lg md:hidden"
        aria-label="New booking"
      >
        +
      </Link>
    </div>
  );
}

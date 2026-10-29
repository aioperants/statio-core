import { addDays } from "./time";

export type RhythmState = "new" | "booked" | "regular" | "dueSoon" | "overdue";
/** Where the estimate comes from, shown next to it so the owner knows how far to trust it. */
export type RhythmSource = "client" | "professional" | "learned" | "standard";

/** A completed visit, oldest first. */
export type PastVisit = {
  day: string;
  /** Service group of the visit (its first service), to keep e.g. cuts and colour apart. */
  group: string | null;
  /** "Come back in" days chosen at checkout, if any. */
  chosen: number | null;
  /** The service's standard estimate. */
  standard: number | null;
};

/** Learning starts once a client has this many visits of the same kind. */
export const LEARN_AFTER = 3;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/**
 * How often a client comes back and when they're due. The estimate comes from the first of:
 * 1. "client": set by hand on the client ("comes every 4 weeks");
 * 2. "professional": what the professional chose at the last checkout, when they changed the standard;
 * 3. "learned": the median gap between their visits of the same kind, once there are enough;
 * 4. "standard": the service's standard estimate.
 * "Due soon" starts when about 80% of their interval has passed. Days are YYYY-MM-DD.
 */
export function clientRhythm(c: { today: string; created: string; visits: PastVisit[]; rhythmDays: number | null; nextBooked: string | null }) {
  const first = c.visits[0]?.day ?? null;
  const last = c.visits.at(-1) ?? null;
  const since = [c.created, first].filter((d): d is string => !!d).sort()[0];
  const sameKind = last ? c.visits.filter((v) => v.group === last.group) : [];
  const gaps = sameKind.slice(1).map((v, i) => daysBetween(sameKind[i].day, v.day)).filter((d) => d > 0);

  let everyDays: number | null = null;
  let source: RhythmSource | null = null;
  if (c.rhythmDays) [everyDays, source] = [c.rhythmDays, "client"];
  else if (last?.chosen && last.chosen !== last.standard) [everyDays, source] = [last.chosen, "professional"];
  else if (sameKind.length >= LEARN_AFTER && gaps.length) [everyDays, source] = [median(gaps), "learned"];
  else if (last?.chosen || last?.standard) [everyDays, source] = [(last.chosen || last.standard)!, "standard"];

  const nextDue = last && everyDays ? addDays(last.day, everyDays) : null;
  const soonFrom = nextDue && everyDays ? addDays(nextDue, -Math.max(3, Math.round(everyDays * 0.2))) : null;
  // A booked visit says the most (also for a brand-new client); otherwise: new, overdue, due soon, regular.
  const state: RhythmState = c.nextBooked
    ? "booked"
    : c.visits.length === 0
      ? "new"
      : nextDue && nextDue < c.today
        ? "overdue"
        : soonFrom && soonFrom <= c.today
          ? "dueSoon"
          : "regular";
  return { since, everyDays, source, learnedFrom: source === "learned" ? sameKind.length : 0, nextDue, state };
}

/** "every 4 wks" from days, rounded to what an owner thinks in. */
export const everyWeeks = (days: number) => Math.max(1, Math.round(days / 7));

/**
 * Days until a birthday ("MM-DD") from `today`, if it falls within `within` days (0 = today).
 * A 29 February birthday counts on 28 February in other years.
 */
export function birthdayIn(birthday: string | null, today: string, within = 7): number | null {
  if (!birthday || !/^\d{2}-\d{2}$/.test(birthday)) return null;
  for (let i = 0; i < within; i++) {
    const d = addDays(today, i);
    const mmdd = d.slice(5);
    const leap = Number(d.slice(0, 4)) % 4 === 0;
    if (mmdd === birthday || (birthday === "02-29" && !leap && mmdd === "02-28")) return i;
  }
  return null;
}

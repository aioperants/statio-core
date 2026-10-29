import type { Interval } from "./slots";

/** Free stretches inside working hours, after removing busy time, of at least `minLength` minutes. */
export function freeGaps(hours: Interval[], busy: Interval[], minLength: number, from = 0): Interval[] {
  const sorted = [...busy].sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const w of hours) {
    let cursor = Math.max(w.start, from);
    for (const b of sorted) {
      if (b.end <= cursor || b.start >= w.end) continue;
      if (b.start > cursor) out.push({ start: cursor, end: Math.min(b.start, w.end) });
      cursor = Math.max(cursor, b.end);
    }
    if (cursor < w.end) out.push({ start: cursor, end: w.end });
  }
  return out.filter((g) => g.end - g.start >= minLength);
}

/** Minutes of `items` that fall inside `hours`. */
export function minutesInside(hours: Interval[], items: Interval[]): number {
  let total = 0;
  for (const w of hours) {
    for (const i of items) total += Math.max(0, Math.min(w.end, i.end) - Math.max(w.start, i.start));
  }
  return total;
}

/**
 * Everyone's free gaps on one day as one list: gaps that overlap become a single stretch
 * (from the earliest start to the latest end) with the names of everyone free in it.
 */
export function mergeGaps(gaps: (Interval & { name: string })[]): (Interval & { names: string[] })[] {
  const out: (Interval & { names: string[] })[] = [];
  for (const g of [...gaps].sort((a, b) => a.start - b.start || b.end - a.end)) {
    const last = out[out.length - 1];
    if (last && g.start < last.end) {
      last.end = Math.max(last.end, g.end);
      if (!last.names.includes(g.name)) last.names.push(g.name);
    } else out.push({ start: g.start, end: g.end, names: [g.name] });
  }
  return out;
}

/**
 * A person's hours cut to when the salon is open. `opening` null = the salon hasn't set
 * opening hours, so the person's hours count as they are.
 */
export function withinOpening(hours: Interval[], opening: Interval[] | null): Interval[] {
  if (!opening) return hours;
  const out: Interval[] = [];
  for (const h of hours)
    for (const o of opening) {
      const start = Math.max(h.start, o.start);
      const end = Math.min(h.end, o.end);
      if (end > start) out.push({ start, end });
    }
  return out.sort((a, b) => a.start - b.start);
}

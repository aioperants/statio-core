/**
 * Time helpers. The salon works in local wall-clock time (its timezone);
 * the database stores UTC instants. A "local day" is a YYYY-MM-DD string and
 * times within it are minutes from local midnight.
 */

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

function parts(instant: Date, tz: string) {
  const p: Record<string, number> = {};
  for (const { type, value } of formatter(tz).formatToParts(instant)) {
    if (type !== "literal") p[type] = Number(value);
  }
  return p as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Offset of `tz` from UTC at `instant`, in minutes (Madrid in summer: +120). */
export function tzOffsetMinutes(instant: Date, tz: string): number {
  const p = parts(instant, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/** The UTC instant of `minutes` after local midnight on `day` in `tz`. */
export function localToUtc(day: string, minutes: number, tz: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, minutes);
  let guess = wall - tzOffsetMinutes(new Date(wall), tz) * 60000;
  // Second pass settles days where the offset changes (daylight saving).
  guess = wall - tzOffsetMinutes(new Date(guess), tz) * 60000;
  return new Date(guess);
}

/** Local day and minutes for a UTC instant. */
export function utcToLocal(instant: Date, tz: string): { day: string; minutes: number } {
  const p = parts(instant, tz);
  return { day: `${p.year}-${pad(p.month)}-${pad(p.day)}`, minutes: p.hour * 60 + p.minute };
}

export function todayIn(tz: string, now = new Date()): string {
  return utcToLocal(now, tz).day;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function minutesToHHMM(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

export function hhmmToMinutes(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

export function isValidDay(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

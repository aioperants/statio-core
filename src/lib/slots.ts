/**
 * The slot engine: which start times can a client book on one local day?
 *
 * Pure and synchronous so it can be tested without a database. All times are
 * minutes from local midnight on the requested day. A visit is one or more
 * services done back to back by the same person.
 */

export interface Interval {
  start: number;
  end: number;
}

export interface SlotService {
  id: string;
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  /** Kind of shared station needed (e.g. "pedicure"), or null. */
  stationKind: string | null;
}

export interface SlotStaff {
  id: string;
  /** Services this person does, with an optional personal duration. */
  services: Record<string, { durationMin?: number | null }>;
  /** Working hours on this day (already resolved from the weekly pattern). */
  hours: Interval[];
  /** Time off on this day. */
  off: Interval[];
  /** Existing active visits on this day, including their buffers. */
  booked: Interval[];
}

export interface SlotStation {
  id: string;
  kind: string;
  /** Service lines already holding this station. */
  booked: Interval[];
}

/** How times are offered online (see business.slotMode). */
export const SLOT_MODES = ["recommend", "only", "all"] as const;
export type SlotMode = (typeof SLOT_MODES)[number];

export interface SlotRules {
  stepMin: number;
  /** Earliest bookable minute on this day (now + notice when the day is today; 0 otherwise). */
  earliestStart: number;
  /** Only offer times next to existing bookings (on days the person has some). */
  compactDay: boolean;
  /** Also offer the exact times next to a booking when they're off the step grid (for recommending them). */
  exactNeighbours?: boolean;
  /** Max visits per person per day for online booking; null = no limit. */
  dailyLimit: number | null;
}

export interface SlotInput {
  services: SlotService[];
  staff: SlotStaff[];
  stations: SlotStation[];
  /** Salon closures on this day. */
  closed: Interval[];
  rules: SlotRules;
  /** A specific person, or null for "anyone". */
  staffId: string | null;
}

export interface PlannedLine {
  serviceId: string;
  start: number;
  end: number;
  stationId: string | null;
}

export interface Slot {
  start: number;
  /** End of the last service (without buffers). */
  end: number;
  staffId: string;
  /** Buffers included: what the visit blocks on the person's calendar. */
  occupied: Interval;
  lines: PlannedLine[];
  /**
   * How well it fits the person's day: 1 for each side that touches a booking, the start or end of
   * their hours, or time off (2 = no gap either side). Used to recommend times.
   */
  fit: number;
}

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;
const inside = (a: Interval, b: Interval) => a.start >= b.start && a.end <= b.end;

/** Lay out the visit for one person starting at `start`. */
function planVisit(services: SlotService[], person: SlotStaff, start: number) {
  const lines: { serviceId: string; start: number; end: number; stationKind: string | null }[] = [];
  let t = start;
  for (const s of services) {
    const d = person.services[s.id]?.durationMin ?? s.durationMin;
    lines.push({ serviceId: s.id, start: t, end: t + d, stationKind: s.stationKind });
    t += d;
  }
  const first = services[0];
  const last = services[services.length - 1];
  return {
    lines,
    end: t,
    occupied: { start: start - first.bufferBeforeMin, end: t + last.bufferAfterMin },
  };
}

/** Pick a free station of each needed kind, or null when one is not available. */
function assignStations(
  lines: { serviceId: string; start: number; end: number; stationKind: string | null }[],
  stations: SlotStation[],
): PlannedLine[] | null {
  const out: PlannedLine[] = [];
  for (const l of lines) {
    if (!l.stationKind) {
      out.push({ serviceId: l.serviceId, start: l.start, end: l.end, stationId: null });
      continue;
    }
    const free = stations.find(
      (st) => st.kind === l.stationKind && !st.booked.some((b) => overlaps(b, l)),
    );
    if (!free) return null;
    out.push({ serviceId: l.serviceId, start: l.start, end: l.end, stationId: free.id });
  }
  return out;
}

function slotsForPerson(input: SlotInput, person: SlotStaff): Slot[] {
  const { services, rules } = input;
  if (services.length === 0) return [];
  if (!services.every((s) => s.id in person.services)) return [];
  if (rules.dailyLimit != null && person.booked.length >= rules.dailyLimit) return [];

  const blocked = [...person.off, ...person.booked, ...input.closed];
  const anchors = new Set<number>();
  for (const b of person.booked) {
    anchors.add(b.start);
    anchors.add(b.end);
  }
  const compact = rules.compactDay && person.booked.length > 0;
  // Edges a visit can sit against without leaving a gap.
  const startEdges = new Set([...person.booked, ...person.off, ...input.closed].map((b) => b.end).concat(person.hours.map((w) => w.start)));
  // The end of their hours only counts once the day has bookings: an empty day fills from the start.
  const busy = person.booked.length > 0;
  const endEdges = new Set([...person.booked, ...person.off, ...input.closed].map((b) => b.start).concat(busy ? person.hours.map((w) => w.end) : []));
  const hourEnds = new Set(busy ? person.hours.map((w) => w.end) : []);
  // The visit's own start/end count against the person's hours (buffers may spill outside them).
  const fitOf = (start: number, end: number, occupied: Interval) =>
    (startEdges.has(occupied.start) || startEdges.has(start) ? 1 : 0) + (endEdges.has(occupied.end) || hourEnds.has(end) ? 1 : 0);

  const result: Slot[] = [];
  for (const window of person.hours) {
    for (let start = window.start; start < window.end; start += rules.stepMin) {
      if (start < rules.earliestStart) continue;
      const plan = planVisit(services, person, start);
      // Buffers may spill outside working hours; the services themselves may not.
      if (!inside({ start, end: plan.end }, window)) continue;
      if (blocked.some((b) => overlaps(b, plan.occupied))) continue;
      if (compact && !anchors.has(plan.occupied.start) && !anchors.has(plan.occupied.end)) continue;
      const lines = assignStations(plan.lines, input.stations);
      if (!lines) continue;
      result.push({ start, end: plan.end, staffId: person.id, occupied: plan.occupied, lines, fit: fitOf(start, plan.end, plan.occupied) });
    }
  }
  // Compact day (or recommending): also offer the exact times next to a booking even if off the step grid.
  if (compact || (rules.exactNeighbours && person.booked.length > 0)) {
    for (const a of anchors) {
      for (const start of [a + services[0].bufferBeforeMin, a - totalLength(services, person)]) {
        if (start % 5 !== 0 || result.some((r) => r.start === start)) continue;
        const plan = planVisit(services, person, start);
        if (start < rules.earliestStart) continue;
        if (!person.hours.some((w) => inside({ start, end: plan.end }, w))) continue;
        if (blocked.some((b) => overlaps(b, plan.occupied))) continue;
        if (!anchors.has(plan.occupied.start) && !anchors.has(plan.occupied.end)) continue;
        const lines = assignStations(plan.lines, input.stations);
        if (lines) result.push({ start, end: plan.end, staffId: person.id, occupied: plan.occupied, lines, fit: fitOf(start, plan.end, plan.occupied) });
      }
    }
    result.sort((a, b) => a.start - b.start);
  }
  return result;
}

function totalLength(services: SlotService[], person: SlotStaff) {
  const work = services.reduce((t, s) => t + (person.services[s.id]?.durationMin ?? s.durationMin), 0);
  return work + services[services.length - 1].bufferAfterMin;
}

/**
 * Bookable slots for the day. With "anyone", each start time appears once,
 * given to the person whose day it fits best: next to an existing booking
 * first (fewer gaps), then the person with fewer bookings.
 */
export function findSlots(input: SlotInput): Slot[] {
  const people = input.staffId ? input.staff.filter((s) => s.id === input.staffId) : input.staff;
  const all = people.flatMap((p) => slotsForPerson(input, p));
  if (input.staffId) return all;

  const byStart = new Map<number, Slot>();
  const load = new Map(input.staff.map((s) => [s.id, s.booked.length]));
  const adjacency = (slot: Slot) => {
    const p = input.staff.find((s) => s.id === slot.staffId)!;
    return p.booked.some((b) => b.end === slot.occupied.start || b.start === slot.occupied.end) ? 1 : 0;
  };
  // Next to a booking first, then the fewest gaps left (fit), then the person with fewer bookings.
  const better = (a: Slot, b: Slot) =>
    adjacency(a) - adjacency(b) || a.fit - b.fit || load.get(b.staffId)! - load.get(a.staffId)!;
  for (const slot of all) {
    const current = byStart.get(slot.start);
    if (!current || better(slot, current) > 0) {
      byStart.set(slot.start, slot);
    }
  }
  return [...byStart.values()].sort((a, b) => a.start - b.start);
}

/**
 * The times to recommend: the ones that leave no gap (a booking, the start or end of the day on
 * either side). At most `max`, in time order.
 */
export function recommendedStarts(slots: { start: number; fit: number }[], max = 4) {
  return slots
    .map((s) => ({ start: s.start, score: s.fit * 2 }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.start - b.start)
    .slice(0, max)
    .map((s) => s.start)
    .sort((a, b) => a - b);
}

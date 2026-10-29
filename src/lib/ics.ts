/**
 * A visit as a calendar event (iCalendar, RFC 5545) with reminders the day before and two
 * hours before, so the client's own phone reminds them. Pure, so it can be tested.
 */
export interface CalendarVisit {
  /** Stable per visit, so a moved or cancelled visit updates the same calendar entry. */
  uid: string;
  start: Date;
  end: Date;
  title: string;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  organizer?: { name: string; email: string } | null;
  attendee?: string | null;
  /** Bigger than the last one sent, or calendars ignore the update. */
  sequence: number;
  cancelled?: boolean;
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Lines longer than 75 bytes continue on the next line after a space. */
function fold(line: string) {
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch) > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
    }
    cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/** `method`: PUBLISH for a download, REQUEST/CANCEL for an email invite. */
export function visitIcs(v: CalendarVisit, method: "PUBLISH" | "REQUEST" | "CANCEL" = "PUBLISH") {
  const cancelled = v.cancelled || method === "CANCEL";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Statio CRM//Bookings//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${v.uid}`,
    `SEQUENCE:${v.sequence}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(v.start)}`,
    `DTEND:${stamp(v.end)}`,
    `SUMMARY:${escape(v.title)}`,
    v.location && `LOCATION:${escape(v.location)}`,
    v.description && `DESCRIPTION:${escape(v.description)}`,
    v.url && `URL:${v.url}`,
    v.organizer && `ORGANIZER;CN=${escape(v.organizer.name)}:mailto:${v.organizer.email}`,
    v.attendee && `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${v.attendee}`,
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
    ...(cancelled
      ? []
      : ["-P1D", "-PT2H"].flatMap((when) => ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escape(v.title)}`, `TRIGGER:${when}`, "END:VALARM"])),
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((l): l is string => !!l);
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Opens Google Calendar with the event filled in (Android has no handler for .ics files). */
export function googleCalendarUrl(v: Pick<CalendarVisit, "start" | "end" | "title" | "location" | "description">) {
  const q = new URLSearchParams({ action: "TEMPLATE", text: v.title, dates: `${stamp(v.start)}/${stamp(v.end)}` });
  if (v.location) q.set("location", v.location);
  if (v.description) q.set("details", v.description);
  return `https://calendar.google.com/calendar/render?${q}`;
}

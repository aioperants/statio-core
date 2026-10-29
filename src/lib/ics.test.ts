import { describe, expect, it } from "vitest";
import { googleCalendarUrl, visitIcs } from "./ics";

const visit = {
  uid: "a1@statio",
  start: new Date("2026-10-22T07:00:00Z"),
  end: new Date("2026-10-22T07:45:00Z"),
  title: "Corte y peinado · Salón Aurora",
  location: "Calle Mayor 12, Madrid",
  description: "Con Marta; 35 €\nVer o cancelar: https://example.com/es/manage/abc",
  sequence: 3,
};

describe("calendar event", () => {
  it("has the times, reminders and escaped text", () => {
    const ics = visitIcs(visit);
    expect(ics).toContain("DTSTART:20261022T070000Z");
    expect(ics).toContain("DTEND:20261022T074500Z");
    expect(ics).toContain("TRIGGER:-P1D");
    expect(ics).toContain("TRIGGER:-PT2H");
    expect(ics).toContain("LOCATION:Calle Mayor 12\\, Madrid");
    expect(ics).toContain("Con Marta\; 35 €\\nVer");
    expect(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
  });
  it("cancels without reminders", () => {
    const ics = visitIcs(visit, "CANCEL");
    expect(ics).toContain("METHOD:CANCEL");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).not.toContain("VALARM");
  });
  it("builds a Google Calendar link", () => {
    expect(googleCalendarUrl(visit)).toContain("dates=20261022T070000Z%2F20261022T074500Z");
  });
});

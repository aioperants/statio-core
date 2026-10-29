import { appointmentDetails, getBusiness } from "@/lib/booking";
import { googleCalendarUrl, visitIcs } from "@/lib/ics";
import { calendarVisit } from "@/lib/notify";

/**
 * The visit for the client's calendar, found by its private manage link token.
 * ?to=google opens Google Calendar instead (Android); otherwise an .ics the phone offers to add.
 */
export async function GET(req: Request, { params }: RouteContext<"/api/calendar/[token]">) {
  const { token } = await params;
  const url = new URL(req.url);
  const [business, appt] = await Promise.all([getBusiness(), token.length >= 20 ? appointmentDetails({ token }) : null]);
  if (!business || !appt) return new Response("Not found", { status: 404 });
  const event = calendarVisit(appt, business, url.searchParams.get("lang") ?? business.defaultLocale);
  if (url.searchParams.get("to") === "google") return Response.redirect(googleCalendarUrl(event), 302);
  const cancelled = !["pending", "confirmed"].includes(appt.status);
  return new Response(visitIcs({ ...event, cancelled }), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="cita.ics"',
      "cache-control": "no-store",
    },
  });
}

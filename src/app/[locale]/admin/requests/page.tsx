import { asc, count, eq, and, inArray, isNull, ne } from "drizzle-orm";
import { formatPhone } from "@/lib/phone";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Empty, PageHeader } from "@/components/admin/ui";
import { db, schema } from "@/db";
import { pageMember, managesAllVisits } from "@/lib/access";
import { clientsToWelcome, pendingAppointments, requireBusiness } from "@/lib/booking";
import { dayLabel, hhmm, money, serviceName } from "@/lib/format";
import { smsLink, waLink, whatsappWelcomeText } from "@/lib/notify";
import { utcToLocal } from "@/lib/time";
import { ApproveAllButton, RequestButtons, WelcomeButtons } from "./request-buttons";
import { allows } from "@/lib/permissions";

export default async function RequestsPage({ params }: PageProps<"/[locale]/admin/requests">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.requests");
  const tv = await getTranslations("admin.visit");
  const business = await requireBusiness();
  const me = await pageMember(locale);
  const list = (await pendingAppointments()).filter((a) => managesAllVisits(me) || a.staffId === me.id);
  const clientIds = [...new Set(list.map((a) => a.clientId))];
  const done = clientIds.length
    ? await db
        .select({ clientId: schema.appointment.clientId, n: count() })
        .from(schema.appointment)
        .where(and(inArray(schema.appointment.clientId, clientIds), eq(schema.appointment.status, "completed")))
        .groupBy(schema.appointment.clientId)
    : [];
  // One card per new client, for their first upcoming visit.
  const seen = new Set<string>();
  const toWelcome = (await clientsToWelcome())
    .filter((a) => (managesAllVisits(me) || a.staffId === me.id) && !seen.has(a.clientId) && seen.add(a.clientId))
    .slice(0, 10);
  const welcome = await Promise.all(
    toWelcome.map(async (a) => {
      const text = await whatsappWelcomeText(a);
      return { a, text, wa: waLink(a.client.phone, text), sms: smsLink(a.client.phone, text) };
    }),
  );

  return (
    <div>
      <PageHeader title={t("title")} />
      <div className="grid grid-cols-1 mx-auto w-full max-w-6xl gap-3 p-4 md:px-8">
        {list.length > 1 && <ApproveAllButton count={list.length} />}
        {list.length === 0 ? (
          <>
            <Empty>{t("empty")}</Empty>
            <p className="text-center text-sm text-muted">{t("why")}</p>
          </>
        ) : (
          list.map((a) => {
            const l = utcToLocal(a.startsAt, business.timezone);
            const visits = done.find((d) => d.clientId === a.clientId)?.n ?? 0;
            return (
              <div key={a.id} className="card grid gap-3 p-4">
                <div>
                  <p className="font-semibold">
                    {a.bookedForName ? `${a.bookedForName} (${a.client.name})` : a.client.name}
                    {visits === 0 && <span className="chip ml-2 bg-brand-soft text-brand">{t("firstVisit")}</span>}
                    {a.client.noShowCount > 0 && <span className="chip ml-2 bg-red-100 text-red-700">{tv("noShows", { count: a.client.noShowCount })}</span>}
                  </p>
                  <p className="text-sm text-muted">{[formatPhone(a.client.phone), a.client.email].filter(Boolean).join(" · ")}</p>
                  <p className="mt-2">{a.lines.map((x) => serviceName(x.service, locale)).join(" + ")}</p>
                  <p className="text-sm text-muted">
                    {dayLabel(l.day, locale)} · {hhmm(l.minutes)} · {a.staff.name} · {money(a.priceCents, business.currency, locale)}
                  </p>
                  {a.notes && <p className="mt-1 text-sm italic">“{a.notes}”</p>}
                </div>
                <RequestButtons id={a.id} />
              </div>
            );
          })
        )}
        {welcome.length > 0 && (
          <section className="mt-4 grid gap-3">
            <div>
              <h2 className="font-semibold">{t("welcomeTitle")}</h2>
              <p className="text-sm text-muted">{t("welcomeHint")}</p>
            </div>
            {welcome.map(({ a, text, wa, sms }) => {
              const l = utcToLocal(a.startsAt, business.timezone);
              return (
                <div key={a.id} className="card grid gap-3 p-4">
                  <div>
                    <p className="font-semibold">{a.client.name}</p>
                    <p className="text-sm text-muted">
                      {dayLabel(l.day, locale)} · {hhmm(l.minutes)} · {a.staff.name}
                    </p>
                  </div>
                  <p className="rounded-xl bg-canvas p-3 text-sm whitespace-pre-line">{text}</p>
                  {wa || sms ? <WelcomeButtons id={a.id} wa={wa} sms={sms} /> : <p className="text-sm text-muted">{t("noPhone")}</p>}
                </div>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}

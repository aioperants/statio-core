import { desc } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/admin/ui";
import { db, schema } from "@/db";
import { managerOnly } from "@/lib/admin-guard";
import { requireBusiness } from "@/lib/booking";
import { dayLabel, hhmm } from "@/lib/format";
import { utcToLocal } from "@/lib/time";

/** Who did what, and when: additions, changes, deletions, exports, access changes. Newest first. */
export default async function ActivityPage({ params, searchParams }: PageProps<"/[locale]/admin/settings/activity">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { denied } = await managerOnly(locale, "team", "full");
  if (denied) return denied;
  const t = await getTranslations("admin.activity");
  const business = await requireBusiness();
  const sp = await searchParams;
  const only = typeof sp.only === "string" && ["client", "staff", "visit"].includes(sp.only) ? sp.only : null;
  const [rows, people] = await Promise.all([
    db.query.auditLog.findMany({ orderBy: desc(schema.auditLog.at), limit: 300 }),
    db.query.staff.findMany({ columns: { userId: true, name: true, lastName: true } }),
  ]);
  const who = (userId: string | null) => {
    const p = people.find((x) => x.userId && x.userId === userId);
    return p ? [p.name, p.lastName].filter(Boolean).join(" ") : userId ? t("someone") : t("system");
  };
  // "client.export" → "Clients · Exported"; unknown kinds show as they are.
  const label = (action: string) => {
    const [obj, verb] = action.split(".");
    return t.has(`objects.${obj}`) && t.has(`verbs.${verb}`) ? `${t(`objects.${obj}`)} · ${t(`verbs.${verb}`)}` : action;
  };
  const risky = (action: string) => /\.(export|import|delete|remove|reset|access)$/.test(action);
  const list = rows.filter((r) => !only || r.action.startsWith(`${only}.`)).slice(0, 200);

  return (
    <div>
      <PageHeader title={t("title")} back={`/${locale}/admin/more`} />
      <div className="grid mx-auto w-full max-w-6xl grid-cols-1 gap-3 p-4 md:px-8">
        <p className="text-sm text-muted">{t("hint")}</p>
        <div className="flex flex-wrap gap-2">
          {[null, "client", "staff", "visit"].map((k) => (
            <a
              key={k ?? "all"}
              href={`/${locale}/admin/settings/activity${k ? `?only=${k}` : ""}`}
              className={`chip border py-2 ${only === k ? "border-brand bg-brand text-white" : "border-line bg-white"}`}
            >
              {t(`filters.${k ?? "all"}`)}
            </a>
          ))}
        </div>
        {list.length === 0 ? (
          <p className="card p-6 text-center text-muted">{t("none")}</p>
        ) : (
          <ul className="card divide-y divide-line">
            {list.map((r) => {
              const l = utcToLocal(r.at, business.timezone);
              return (
                <li key={r.id} className="flex gap-3 p-3 text-sm">
                  <span className="w-24 shrink-0 text-xs text-muted">
                    {dayLabel(l.day, locale, "short")}
                    <br />
                    {hhmm(l.minutes)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block font-medium ${risky(r.action) ? "text-red-800" : ""}`}>{label(r.action)}</span>
                    <span className="block truncate text-muted">
                      {who(r.userId)}
                      {r.detail && !/^[0-9a-f-]{36}$/.test(r.detail) && ` · ${r.detail}`}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

import Link from "next/link";
import { formatPhone } from "@/lib/phone";
import { asc, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Avatar } from "@/components/avatar";
import { Empty, PageHeader, Tabs } from "@/components/admin/ui";
import { db, schema } from "@/db";
import { managerOnly } from "@/lib/admin-guard";
import { isAccess } from "@/lib/permissions";
import { Key, LinkIcon } from "@/components/icons";

export default async function StaffPage({ params }: PageProps<"/[locale]/admin/staff">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { denied } = await managerOnly(locale, "team", "edit");
  if (denied) return denied;
  const t = await getTranslations("admin.staff");
  const tt = await getTranslations("admin.team");
  const people = await db.query.staff.findMany({
    where: eq(schema.staff.active, true),
    
    orderBy: asc(schema.staff.sortOrder),
  });

  return (
    <div>
      <PageHeader help={`/${locale}/admin/help#staff`}
        title={tt("title")}
        back={`/${locale}/admin/settings`}
        action={
          <Link href={`/${locale}/admin/staff/new`} className="btn-primary min-h-9 px-3 py-1.5 text-sm">
            + {t("add")}
          </Link>
        }
      />
      <div className="grid grid-cols-1 mx-auto w-full max-w-6xl gap-3 p-4 md:px-8">
        <Tabs tabs={[{ href: `/${locale}/admin/staff`, label: tt("people"), on: true }, { href: `/${locale}/admin/settings/week`, label: tt("shifts"), on: false }]} />
        <p className="text-sm text-muted">{t("clientsRule")}</p>
        {people.length === 0 && <Empty>{t("none")}</Empty>}
        {/* A quick overview: who they are, what they do, how to reach them. Hours are in Shifts. */}
        {people.map((p) => {
          const status = p.pausedAt ? "paused" : p.userId ? "active" : p.inviteToken && p.inviteExpiresAt && p.inviteExpiresAt > new Date() ? "invited" : "none";
          const role = [p.jobTitle, p.title].filter(Boolean).join(" · ");
          const invite = p.access !== "owner" && (status === "none" || status === "invited");
          return (
            <div key={p.id} className="card flex items-center gap-3 p-4">
            <Link href={`/${locale}/admin/staff/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={p.name} photo={p.photo} color={p.color} />
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold">{[p.name, p.lastName].filter(Boolean).join(" ")}</span>
                  <span className="chip bg-canvas text-muted">
                    {t(`access.levels.${(isAccess(p.access) ? p.access : "stylist") as "stylist"}`)}
                    {Object.keys(p.permissions).length > 0 && <span title={t("access.custom")} aria-label={t("access.custom")}> <Key className="inline size-4 align-[-3px]" /></span>}
                  </span>
                  {p.access !== "owner" && status !== "active" && (
                    <span className={`chip ${status === "invited" ? "bg-amber-100 text-amber-900" : status === "paused" ? "bg-red-50 text-red-800" : "bg-canvas text-muted"}`}>{t(`invite.status.${status}`)}</span>
                  )}
                </span>
                <span className={`truncate text-sm ${role ? "" : "text-muted"}`}>{role || t("noTitle")}</span>
                <span className="truncate text-sm text-muted">{[formatPhone(p.phone), p.email].filter(Boolean).join(" · ") || t("noContact")}</span>
              </span>
              {!invite && <span className="text-muted">›</span>}
            </Link>
            {/* Not signed in yet: the invite link is one tap away, not hidden inside their page. */}
            {invite && (
              <Link href={`/${locale}/admin/staff/${p.id}?invite=1#access`} className="btn-ghost min-h-9 shrink-0 px-3 text-sm">
                <LinkIcon className="inline size-4 align-[-3px]" /> <span className="max-sm:sr-only">{t(status === "invited" ? "invite.resend" : "invite.send")}</span>
              </Link>
            )}
            </div>
          );
        })}
        {/* Tools each person owns or rents: rarely used, so one quiet line here instead of a menu item. */}
        <Link href={`/${locale}/admin/equipment`} className="card flex items-center gap-3 p-4">
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{tt("equipment")}</span>
            <span className="block text-sm text-muted">{tt("equipmentHint")}</span>
          </span>
          <span className="text-muted">›</span>
        </Link>
      </div>
    </div>
  );
}

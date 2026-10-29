import { getTranslations, setRequestLocale } from "next-intl/server";
import { Download } from "@/components/icons";
import { PageHeader } from "@/components/admin/ui";
import { managerOnly } from "@/lib/admin-guard";

/** "Download my data": everything in one ZIP (the owner), or the clients, bookings and services as spreadsheets (CSV). */
export default async function DataPage({ params }: PageProps<"/[locale]/admin/data">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { me, denied } = await managerOnly(locale);
  if (denied) return denied;
  const t = await getTranslations("data");
  return (
    <div>
      <PageHeader title={t("title")} back={`/${locale}/admin/more`} />
      <div className="grid mx-auto w-full max-w-6xl gap-4 p-4 md:px-8">
        <p className="text-sm text-muted">{t("intro")}</p>
        {me?.access === "owner" && (
          <a href="/api/export/all" download className="card flex items-center gap-3 border-ink p-4 ring-1 ring-ink">
            <Download className="size-5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{t("all.name")}</span>
              <span className="block text-sm text-muted">{t("all.what")}</span>
            </span>
          </a>
        )}
        <ul className="card divide-y divide-line">
          {(["clients", "bookings", "services"] as const).map((k) => (
            <li key={k}>
              <a href={`/api/export/${k}`} download className="flex items-center gap-3 p-4">
                <Download className="size-5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t(`${k}.name`)}</span>
                  <span className="block text-sm text-muted">{t(`${k}.what`)}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

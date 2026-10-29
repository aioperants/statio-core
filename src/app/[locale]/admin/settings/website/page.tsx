import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/admin/ui";
import { DeviceFrame } from "@/components/admin/device-frame";
import { QrDownload } from "@/components/admin/qr-download";
import { Facts, SummaryCard } from "@/components/admin/summary-card";
import { managerOnly } from "@/lib/admin-guard";
import { requireBusiness } from "@/lib/booking";
import { qrSvg } from "@/lib/qr";
import { salonUrl } from "@/lib/salon-url";
import { websiteRow } from "@/lib/site/data";
import { CopyLink } from "../../salon/copy-link";

/**
 * Settings › Website: the website, its web address and the booking link with its QR code, as they are
 * now. The editor (full screen) and the booking page's look are one level deeper.
 */
export default async function WebsiteSettingsPage({ params }: PageProps<"/[locale]/admin/settings/website">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { denied } = await managerOnly(locale);
  if (denied) return denied;
  const t = await getTranslations("admin.siteHub");
  const b = await requireBusiness();
  const row = await websiteRow();
  const base = `/${locale}/admin`;
  const live = Boolean(row.enabled && row.publishedAt);
  // The address is this deployment's own (BETTER_AUTH_URL), set in Vercel with the domain.
  const address = salonUrl();
  const bookUrl = `${address}/${b.defaultLocale}/book`;
  const changed = row.updatedAt && row.publishedAt && row.updatedAt > row.publishedAt;
  const status = !live ? "draft" : changed ? "changes" : "live";
  return (
    <div>
      <PageHeader help={`${base}/help#website`} title={t("title")} back={`${base}/settings`} hint={t("intro")} />
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-start gap-4 p-4 md:px-8 lg:grid-cols-2">
        <SummaryCard title={t("site")} className="lg:col-span-2">
          <div className="grid items-center gap-4 md:grid-cols-[minmax(0,420px)_1fr] md:gap-6">
            {/* The website as clients see it on a computer, scaled down. */}
            <div className="pointer-events-none overflow-hidden rounded-xl border border-line">
              <DeviceFrame src={`/${b.defaultLocale}/website-preview`} device="computer" height={240} title={t("site")} />
            </div>
            <div className="grid gap-3">
              <span className={`chip justify-self-start ${status === "live" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{t(`status.${status}`)}</span>
              {row.publishedAt && <Facts rows={[[t("published"), row.publishedAt.toLocaleDateString(locale, { day: "numeric", month: "long", timeZone: b.timezone })]]} />}
              <div className="flex flex-wrap gap-2">
                <Link href={`${base}/website`} className="btn-primary min-h-10 px-5 py-2 text-sm">
                  {t("edit")}
                </Link>
                <a href={live ? address : `/${b.defaultLocale}`} target="_blank" rel="noreferrer" className="btn-ghost min-h-10 px-5 py-2 text-sm">
                  {t("view")} ↗
                </a>
              </div>
            </div>
          </div>
        </SummaryCard>
        <SummaryCard title={t("address")}>
          <Facts rows={[[t("yours"), <b key="a">{address.replace(/^https?:\/\//, "")}</b>]]} />
          <p className="text-sm text-muted">{t("addressVercel")}</p>
        </SummaryCard>
        <div className="grid gap-4">
          <SummaryCard title={t("booking")} action={t("preview")} href={`${base}/website/booking-page`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <span className="size-20 shrink-0 rounded-lg border border-line bg-white p-1.5 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qrSvg(bookUrl) }} />
              <div className="grid min-w-0 flex-1 gap-2">
                <CopyLink value={bookUrl} share={{ title: b.name }} />
                <QrDownload url={bookUrl} salon={b.name} label={t("downloadQr")} className="btn-ghost min-h-9 justify-self-start px-3 py-1.5 text-sm" />
              </div>
            </div>
            <p className="text-sm text-muted">{t("bookingHint")}</p>
          </SummaryCard>
          <ul className="card divide-y divide-line">
            <li>
              <Link href={`${base}/website/booking-page`} className="flex items-center gap-3 p-4">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{t("look")}</span>
                  <span className="block text-sm text-muted">{t("lookHint")}</span>
                </span>
                <span className="text-muted">›</span>
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

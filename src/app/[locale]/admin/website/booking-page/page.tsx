import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/admin/ui";
import { managerOnly } from "@/lib/admin-guard";
import { requireBusiness } from "@/lib/booking";
import { bookingLookOf } from "@/lib/booking-look";
import { salonUrl } from "@/lib/salon-url";
import { saveBookingLook } from "../../_actions/settings";
import { BookingPageSettings } from "./booking-page-settings";

/** Settings › Website › Booking page: how it looks, its link and a QR code for the front desk. */
export default async function BookingPagePage({ params, searchParams }: PageProps<"/[locale]/admin/website/booking-page">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { denied } = await managerOnly(locale);
  if (denied) return denied;
  const t = await getTranslations("admin.bookingPage");
  const tc = await getTranslations("common");
  const b = await requireBusiness();
  const saved = (await searchParams).saved === "1";
  const path = `/${b.defaultLocale}/book`;
  return (
    <div>
      <PageHeader title={t("title")} back={`/${locale}/admin/settings/website`} wide />
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 p-4 md:px-8">
        {saved && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">✓ {tc("saved")}</p>}
        <BookingPageSettings look={bookingLookOf(b.bookingLook)} path={path} url={`${salonUrl()}${path}`} salon={b.name} save={saveBookingLook.bind(null, locale)} />
      </div>
    </div>
  );
}

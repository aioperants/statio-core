import { getTranslations, setRequestLocale } from "next-intl/server";
import { BrandHeader } from "@/components/brand";
import { getBusiness } from "@/lib/booking";
import { publicLogo } from "@/lib/public-logo";
import { maskEmail, peekTicket } from "@/lib/recovery";
import { TicketButton } from "../../forms";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

/** From the email: what this link does, and one tap to do it (see lib/recovery). */
export default async function Page({ params }: PageProps<"/[locale]/recovery/confirm/[token]">) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("recovery");
  const business = await getBusiness();
  const ticket = await peekTicket("recovery-confirm", token);
  return (
    <main className="statio min-h-dvh px-4">
      <div className="mx-auto grid max-w-sm gap-4 pb-10">
        <BrandHeader name={business?.name ?? "Statio CRM"} logo={await publicLogo(business)} />
        {ticket ? (
          <>
            <div className="text-center">
              <h1 className="text-xl font-semibold">{t("confirmTitle")}</h1>
              <p className="mt-1 text-sm text-muted">{t("confirmIntro", { email: maskEmail(ticket.email), salon: business?.name ?? "" })}</p>
            </div>
            <TicketButton locale={locale} token={token} kind="confirm" />
          </>
        ) : (
          <p className="card p-6 text-center text-muted">{t("expired")}</p>
        )}
      </div>
    </main>
  );
}

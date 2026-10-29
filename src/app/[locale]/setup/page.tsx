import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getSession } from "@/lib/access";
import { getBusiness } from "@/lib/booking";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

/** First run: one form that creates the salon (name, kind, country, languages) and the owner. */
export default async function SetupPage({ params }: PageProps<"/[locale]/setup">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await getSession();
  if (!session) redirect(`/${locale}/signin?next=/${locale}/setup`);
  if ((await getBusiness())?.setupDone) redirect(`/${locale}/admin`);
  return <SetupForm locale={locale} />;
}

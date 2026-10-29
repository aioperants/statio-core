import { getTranslations, setRequestLocale } from "next-intl/server";
import { ACCOUNT, canUse } from "@/components/admin/nav";
import { SignOutButton } from "@/components/admin/sign-out";
import { PageHeader } from "@/components/admin/ui";
import { pageMember } from "@/lib/access";
import { allows, type Area, type Level } from "@/lib/permissions";
import { Label, Row } from "../rows";

/** More › My account (phones): security, activity and data, and signing out. */
export default async function AccountMenuPage({ params }: PageProps<"/[locale]/admin/more/account">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin.nav");
  const me = await pageMember(locale);
  const can = (a: Area, l: Exclude<Level, "none">) => allows(me, a, l);
  const admin = `/${locale}/admin`;
  return (
    <div>
      <PageHeader title={t("myAccount")} back={`${admin}/more`} />
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 p-4 md:px-8">
        <Label>
          {me.name} · <span className="normal-case tracking-normal">{me.user.email}</span>
        </Label>
        <ul className="card divide-y divide-line">
          {ACCOUNT.filter((i) => canUse(i.need, can)).map((i) => (
            <Row key={i.key} href={admin + i.href} icon={i.key} label={t(i.key)} />
          ))}
          <li className="p-4">
            <SignOutButton locale={locale} className="font-medium text-muted" />
          </li>
        </ul>
      </div>
    </div>
  );
}

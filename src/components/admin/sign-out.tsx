"use client";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({ locale, className = "btn-ghost" }: { locale: string; className?: string }) {
  const t = useTranslations("common");
  return (
    <button className={className} onClick={() => authClient.signOut().then(() => (window.location.href = `/${locale}/admin`))}>
      {t("signOut")}
    </button>
  );
}

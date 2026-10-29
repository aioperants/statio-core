import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronRight } from "@/components/icons";

export type Setup = { percent: number; items: { key: string; href: string; done: boolean }[] };

/**
 * "Finish setup · 38%", in one small block that opens the list of what's
 * left. In the side menu on a computer, and as one slim row on Today on a phone, so the day comes first.
 */
export function SetupBlock({ setup, locale, className = "" }: { setup: Setup; locale: string; className?: string }) {
  const t = useTranslations("admin.nav");
  const tr = useTranslations("readiness");
  const left = setup.items.filter((i) => !i.done);
  return (
    <details className={`group rounded-xl border border-line bg-white ${className}`}>
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2 text-[13px] font-semibold">
            {t("setup")}
            <span className="text-muted">{setup.percent}%</span>
          </span>
          <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-line" aria-hidden>
            <span className="block h-full rounded-full bg-ink" style={{ width: `${setup.percent}%` }} />
          </span>
          <span className="mt-1.5 block text-[12px] text-muted">
            {t("setupLeft", { left: left.length })}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted transition group-open:rotate-90" />
      </summary>
      <ul className="grid border-t border-line p-1.5">
        {left.map((i) => (
          <li key={i.key}>
            <Link href={`/${locale}${i.href}`} className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] hover:bg-ink/[0.04]">
              <span className="size-4 shrink-0 rounded-full border border-line" aria-hidden />
              <span className="flex-1">{tr(`items.${i.key}` as "items.logo")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

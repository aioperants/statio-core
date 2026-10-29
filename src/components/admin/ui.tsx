"use client";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { ChevronLeft, Help } from "@/components/icons";

/**
 * One page width for every admin page, centred in the space next to the menu, so titles and content
 * start at the same place on every page. The header always lines up with the content under it.
 */
const WIDTH = "mx-auto w-full max-w-6xl";

/** `help`: link to the owner's guide topic for this screen. `hint`: one line under the title (computer). */
export function PageHeader({ title, back, action, help, hint }: { title: string; back?: string; action?: React.ReactNode; /** Kept for compatibility; every page has the same width. */ wide?: boolean; help?: string; hint?: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur md:static md:border-0 md:bg-transparent">
      <div className={`flex min-h-14 items-center gap-2 px-4 py-2 md:px-8 md:pt-10 md:pb-2 ${WIDTH}`}>
        {/* More is the phone's menu; on a computer the side menu is always there, so no way back to it. */}
        {back && (
          <Link href={back} className={`-ml-2 size-10 items-center justify-center rounded-full text-ink hover:bg-ink/[0.05] md:size-9 ${back.endsWith("/admin/more") ? "flex md:hidden" : "flex"}`} aria-label="Back">
            <ChevronLeft className="size-5" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold md:text-[28px] md:leading-9">{title}</h1>
          {hint && <p className="mt-1 hidden text-muted md:block">{hint}</p>}
        </div>
        {help && (
          <Link href={help} aria-label="Help" className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-white text-muted hover:text-ink">
            <Help className="size-[18px]" />
          </Link>
        )}
        {action}
      </div>
    </header>
  );
}

export function Body({ children }: { children: React.ReactNode; /** Kept for compatibility. */ wide?: boolean }) {
  return <div className={`grid grid-cols-1 gap-4 p-4 md:gap-5 md:px-8 ${WIDTH}`}>{children}</div>;
}

export function SubmitButton({ children, className = "btn-primary w-full" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  const t = useTranslations("common");
  return (
    <button disabled={pending} className={className}>
      {pending ? t("loading") : children}
    </button>
  );
}

export function Toggle({ name, label, hint, defaultChecked }: { name: string; label: string; hint?: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <span className="flex-1">
        <span className="block font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-sm text-muted">{hint}</span>}
      </span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="relative mt-0.5 h-7 w-12 shrink-0 rounded-full bg-gray-300 transition peer-checked:bg-brand after:absolute after:top-0.5 after:left-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
    </label>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="card p-8 text-center text-muted">{children}</p>;
}


/** Two or three views of one page (Team: People · Shifts), as links, so each keeps its own address. */
export function Tabs({ tabs }: { tabs: { href: string; label: string; on: boolean }[] }) {
  return (
    <nav className="flex gap-1 rounded-full bg-ink/[0.05] p-1 text-sm font-medium md:self-start">
      {tabs.map((x) => (
        <Link key={x.href} href={x.href} aria-current={x.on ? "page" : undefined} className={`flex-1 rounded-full px-4 py-1.5 text-center md:flex-none ${x.on ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}>
          {x.label}
        </Link>
      ))}
    </nav>
  );
}

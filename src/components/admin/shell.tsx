"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand";
import { NavIcon } from "@/components/icons";
import { type Area, type Level, LEVELS } from "@/lib/permissions";
import { ACCOUNT, canUse, NAV, SETTINGS } from "./nav";
import { type Setup, SetupBlock } from "./setup-block";
import { SignOutButton } from "./sign-out";


/** Pages that live under Settings (so "Settings" / "More" stays highlighted inside them). */
const SETTINGS_PATHS = ["/settings", ...SETTINGS.flatMap((g) => g.items.filter((i) => !i.href.includes("#")).map((i) => i.href))];

export function AdminShell(props: {
  locale: string;
  salon: { name: string; logo: string | null };
  me: { name: string };
  /** What this person may do (from lib/permissions), to show only the menu items they can use. */
  perms: Record<Area, Level>;
  requests: number;
  /** New salons, for the owner: what's left to set up (null when done). */
  setup: Setup | null;
  children: React.ReactNode;
}) {
  const t = useTranslations("admin.nav");
  // A page kept open across an update may not have a new menu word yet: never show a raw key.
  const label = (k: string) => (t.has(k) ? t(k as "today") : k.charAt(0).toUpperCase() + k.slice(1));
  const path = usePathname();
  const base = `/${props.locale}/admin`;
  const under = (href: string) => path === base + href || path.startsWith(base + href + "/");
  const can = (a: Area, l: Exclude<Level, "none">) => LEVELS.indexOf(props.perms[a]) >= LEVELS.indexOf(l);
  const setsUp = canUse("setup", can);
  const inSettings = setsUp && SETTINGS_PATHS.some(under);
  const isActive = (href: string) => (href === "" ? path === base : href === "/settings" ? inSettings : under(href) && !(inSettings && href !== "/settings"));
  const more = NAV.more.filter((i) => canUse(i.need, can));
  // Everything that isn't one of the four tabs lives under "More" on a phone.
  const moreActive = !NAV.tabs.some((i) => isActive(i.href));
  const sideLink = (on: boolean) =>
    `flex items-center gap-3 rounded-lg px-2.5 py-2 text-[14px] font-medium transition-colors ${on ? "bg-ink/[0.06] text-ink" : "text-muted hover:bg-ink/[0.04] hover:text-ink"}`;
  // Daily work first, then the things that grow the salon; Settings and help sit at the bottom.
  const grow = more.filter((i) => i.key !== "settings");
  const settings = more.find((i) => i.key === "settings");
  const account = ACCOUNT.filter((i) => canUse(i.need, can));
  const item = (i: { key: string; href: string }) => (
    <Link key={i.key} href={base + i.href} className={sideLink(isActive(i.href))} title={label(i.key)}>
      <NavIcon name={i.key} className="size-[18px] shrink-0" />
      <span className="flex-1 truncate">{label(i.key)}</span>
      {i.key === "requests" && props.requests > 0 && <Badge n={props.requests} />}
    </Link>
  );

  return (
    <div className="statio admin min-h-dvh md:flex">
      {/* Tablet and computer: one fixed side menu, grouped */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-white md:flex">
        <div className="flex h-16 items-center gap-3 border-b border-line px-4">
          <Logo name={props.salon.name} logo={props.salon.logo} size={32} />
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{props.salon.name}</span>
          <a href={`/${props.locale}/book`} target="_blank" title={t("bookingPage")} aria-label={t("bookingPage")} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-ink/[0.04] hover:text-ink">
            <NavIcon name="bookingPage" className="size-4" />
          </a>
        </div>
        <nav className="grid gap-0.5 overflow-y-auto p-3">
          {NAV.tabs.map(item)}
          {grow.length > 0 && <p className="mt-5 mb-1 px-2.5 text-[11px] font-semibold tracking-wider text-muted uppercase">{label("grow")}</p>}
          {grow.map(item)}
        </nav>
        <div className="mt-auto grid gap-0.5 border-t border-line p-3">
          {props.setup && <SetupBlock setup={props.setup} locale={props.locale} className="mb-2" />}
          {settings && item(settings)}
          <Link href={`${base}/help`} className={sideLink(under("/help"))}>
            <NavIcon name="help" className="size-[18px] shrink-0" />
            <span className="flex-1">{label("help")}</span>
          </Link>
          {/* Account menu: the account, security and data, out of the way of daily work. */}
          <details className="group relative mt-1">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-ink/[0.04] [&::-webkit-details-marker]:hidden">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-white">{props.me.name.slice(0, 1).toUpperCase()}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{props.me.name}</span>
              <NavIcon name="more" className="size-4 text-muted" />
            </summary>
            <div className="absolute inset-x-0 bottom-full z-30 mb-1 grid gap-0.5 rounded-xl border border-line bg-white p-1.5 shadow-lg">
              {account.map((i) => (
                <Link key={i.key} href={base + i.href} className={sideLink(under(i.href))}>
                  <NavIcon name={i.key} className="size-[18px] shrink-0" />
                  <span className="flex-1">{label(i.key)}</span>
                </Link>
              ))}
              <div className="mt-1 border-t border-line px-2.5 pt-2 pb-1">
                <SignOutButton locale={props.locale} className="text-[13px] font-medium text-muted hover:text-ink" />
              </div>
            </div>
          </details>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Computer: a slim top bar with what reception reaches for all day (find a client, book). */}
        <div className="sticky top-0 z-20 hidden h-16 items-center gap-3 border-b border-line bg-white/90 px-8 backdrop-blur md:flex">
          <form action={`${base}/clients`} className="relative w-full min-w-0 max-w-sm">
            <NavIcon name="found" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input name="q" type="search" placeholder={label("search")} className="h-10 w-full rounded-full border border-line bg-canvas pr-4 pl-9 text-[14px] outline-none focus:border-ink focus:bg-white" />
          </form>
          <div className="flex-1" />
          <Link href={`${base}/block`} className="hidden h-10 shrink-0 items-center gap-2 rounded-full border border-line px-4 text-[14px] font-medium whitespace-nowrap hover:border-ink md:inline-flex">
            <NavIcon name="block" className="size-4" />
            {t("block")}
          </Link>
          <Link href={`${base}/new`} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 whitespace-nowrap text-[14px] font-semibold text-white">
            <NavIcon name="feature" className="size-4" />
            {label("newBooking")}
          </Link>
        </div>
        <div className="pb-24 md:pb-12">{props.children}</div>
      </div>

      {/* Phone: bottom tabs within thumb reach */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-white/95 pt-1.5 backdrop-blur md:hidden">
        {[...NAV.tabs, { href: "/more", key: "more" }].map((i) => {
          const on = i.key === "more" ? moreActive : isActive(i.href);
          return (
            <Link key={i.key} href={base + i.href} className={`relative flex flex-col items-center gap-1 py-1 text-[11px] font-medium ${on ? "text-brand" : "text-muted"}`}>
              <NavIcon name={i.key} className={`size-[22px] ${on ? "stroke-[2.25]" : ""}`} />
              {label(i.key)}
              {i.key === "requests" && props.requests > 0 && (
                <span className="absolute top-0 left-1/2 ml-2">
                  <Badge n={props.requests} />
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function Badge({ n }: { n: number }) {
  return <span className="rounded-full bg-red-600 px-1.5 text-[11px] leading-4 font-bold text-white">{n}</span>;
}

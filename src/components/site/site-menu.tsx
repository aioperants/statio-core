"use client";
import { useEffect, useRef, useState } from "react";

/**
 * The website's menu: a ≡ button (the same on phones and computers) opening a panel with the
 * page's sections, the phone and Book. Built on <details>, so it opens without any script too;
 * with it, Esc and a tap outside close it, focus stays inside while open, and a link closes it.
 */
export function SiteMenu(props: { label: string; close: string; links: { href: string; label: string }[]; phone: { href: string; label: string } | null; book: { href: string; label: string } }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !open) return;
    const panel = el.querySelector<HTMLElement>("[role=dialog]");
    panel?.querySelector<HTMLElement>("a,button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") return shut();
      if (e.key !== "Tab" || !panel) return;
      // Keep focus inside the panel while it's open.
      const items = [...panel.querySelectorAll<HTMLElement>("a,button")];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus());
      else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus());
    };
    document.addEventListener("keydown", key);
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const shut = () => {
    if (ref.current) ref.current.open = false;
    setOpen(false);
    ref.current?.querySelector("summary")?.focus();
  };

  return (
    <details ref={ref} className="s-menu" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary aria-label={props.label} aria-expanded={open} aria-controls="site-menu" className="s-btn-ghost grid !min-h-10 size-10 cursor-pointer list-none place-items-center !p-0 [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" className="size-5" aria-hidden>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </summary>
      {/* The page dims behind the panel; a tap on it closes the menu. */}
      <div aria-hidden onClick={shut} className="fixed inset-0 z-40 bg-black/40 md:block" />
      <div
        id="site-menu"
        role="dialog"
        aria-modal="true"
        aria-label={props.label}
        className="s-menu-panel fixed inset-0 z-50 flex flex-col overflow-y-auto px-6 pt-4 pb-8 md:inset-y-0 md:right-0 md:left-auto md:w-[420px] md:shadow-2xl"
        style={{ background: "var(--s-bg)", color: "var(--s-text)" }}
      >
        <div className="flex justify-end">
          <button type="button" onClick={shut} aria-label={props.close} className="grid size-10 place-items-center text-2xl">
            ×
          </button>
        </div>
        <nav className="mt-2 grid">
          {props.links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => shut()} className="s-h s-line border-b py-4 text-2xl">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto grid gap-3 pt-8">
          {props.phone && (
            <a href={props.phone.href} className="s-btn-ghost justify-center">
              {props.phone.label}
            </a>
          )}
          <a href={props.book.href} className="s-btn justify-center">
            {props.book.label}
          </a>
        </div>
      </div>
    </details>
  );
}

import Link from "next/link";

/**
 * One part of a Settings page as it is now (Business, Website): a title, what's set, and one button
 * to change it on its own page. Read first, edit only the part you want.
 */
export function SummaryCard({ title, action, href, className = "", children }: { title: string; action?: string; href?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`card grid content-start gap-3 p-4 md:p-5 ${className}`}>
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 font-semibold">
          {title}
        </h2>
        {action && href && (
          <Link href={href} className="shrink-0 rounded-full border border-line px-3 py-1 text-sm font-semibold hover:bg-canvas">
            {action}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** A label and its value, one line each: "Phone  +34 600 123 456". */
export function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-4 gap-y-1 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

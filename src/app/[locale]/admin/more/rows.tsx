import Link from "next/link";
import { NavIcon } from "@/components/icons";

/** One row of the phone's menu (More and My account). */
export const Row = ({ href, icon, label, hint, external, end }: { href: string; icon: string; label: string; hint?: string; external?: boolean; end?: React.ReactNode }) => (
  <li>
    <Link href={href} target={external ? "_blank" : undefined} className="flex items-center gap-3 p-4 font-medium">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-canvas text-ink">
        <NavIcon name={icon} />
      </span>
      <span className="min-w-0 flex-1">
        {label}
        {hint && <span className="block truncate text-sm font-normal text-muted">{hint}</span>}
      </span>
      {end ?? <span className="text-muted">›</span>}
    </Link>
  </li>
);
export const Label = ({ children }: { children: React.ReactNode }) => <h2 className="-mb-2 px-1 text-[12px] font-semibold tracking-wider text-muted uppercase">{children}</h2>;

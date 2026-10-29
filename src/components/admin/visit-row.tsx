import Link from "next/link";
import { useTranslations } from "next-intl";
import { hhmm, serviceName } from "@/lib/format";

export interface VisitRowData {
  id: string;
  startMin: number;
  endMin: number;
  status: string;
  bookedForName: string | null;
  source: string;
  client: { name: string; noShowCount: number };
  staff: { name: string; color: string };
  lines: { service: { names?: Record<string, string>; nameEn: string; nameEs: string } }[];
}

export const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  completed: "bg-gray-100 text-gray-600",
  no_show: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
  declined: "bg-gray-100 text-gray-500",
};

export function VisitRow({ v, locale, showStaff = true }: { v: VisitRowData; locale: string; showStaff?: boolean }) {
  const ts = useTranslations("status");
  return (
    <Link href={`/${locale}/admin/visit/${v.id}`} className="flex items-center gap-3 p-3.5 active:bg-canvas">
      <span className="w-12 shrink-0 text-right">
        <span className="block font-semibold">{hhmm(v.startMin)}</span>
        <span className="block text-xs text-muted">{hhmm(v.endMin % 1440)}</span>
      </span>
      <span style={{ background: v.staff.color }} className="h-10 w-1.5 shrink-0 rounded-full" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {v.bookedForName ? `${v.bookedForName} (${v.client.name})` : v.client.name}
          {v.client.noShowCount > 0 && <span className="ml-1 text-xs text-red-600">⚠︎{v.client.noShowCount}</span>}
        </span>
        <span className="block truncate text-sm text-muted">
          {v.lines.map((l) => serviceName(l.service, locale)).join(" + ")}
          {showStaff && ` · ${v.staff.name}`}
        </span>
      </span>
      {v.status !== "confirmed" && <span className={`chip ${STATUS_STYLE[v.status]}`}>{ts(v.status)}</span>}
    </Link>
  );
}

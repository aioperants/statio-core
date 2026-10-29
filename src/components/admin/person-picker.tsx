"use client";
import { Avatar } from "@/components/avatar";

/**
 * Pick a person with one tap: big cards with their photo (or initial) and name, instead of a small
 * dropdown, for busy hands between clients. `anyone` adds an "Anyone available" card first.
 */
export function PersonPicker({
  people,
  value,
  onChange,
  anyone,
}: {
  people: { id: string; name: string; photo?: string | null; color?: string; note?: string | null }[];
  value: string | null;
  onChange: (id: string | null) => void;
  anyone?: string;
}) {
  const card = (on: boolean) =>
    `flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border p-2 text-center text-sm font-medium transition active:scale-[0.98] ${on ? "border-brand bg-brand-soft ring-2 ring-brand" : "border-line bg-white"}`;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup">
      {anyone && (
        <button type="button" role="radio" aria-checked={value === null} onClick={() => onChange(null)} className={card(value === null)}>
          <span className="flex size-11 items-center justify-center rounded-full bg-canvas text-lg" aria-hidden>
            ✦
          </span>
          <span className="leading-tight">{anyone}</span>
        </button>
      )}
      {people.map((p) => (
        <button key={p.id} type="button" role="radio" aria-checked={value === p.id} onClick={() => onChange(p.id)} className={card(value === p.id)}>
          <Avatar name={p.name} photo={p.photo} color={p.color} size={44} />
          <span className="w-full truncate leading-tight">{p.name}</span>
          {p.note && <span className="w-full truncate text-xs font-normal text-muted">{p.note}</span>}
        </button>
      ))}
    </div>
  );
}

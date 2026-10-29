"use client";
import { useRouter } from "next/navigation";

/** Tapping the date opens the phone's own date picker. */
export function DatePicker({ value, label, base }: { value: string; label: string; base: string }) {
  const router = useRouter();
  return (
    <label className="relative cursor-pointer px-1 text-base font-semibold">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => {
          if (!e.target.value) return;
          const u = new URL(base, window.location.origin);
          u.searchParams.set("day", e.target.value);
          router.push(u.pathname + u.search);
        }}
        className="absolute inset-0 opacity-0"
      />
    </label>
  );
}

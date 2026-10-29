"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Opens the same admin page in this person's own language (a link may have come in another one). */
export function LanguageRedirect({ to }: { to: string }) {
  const path = usePathname();
  useEffect(() => {
    window.location.replace(path.replace(/^\/[a-z]{2}(?=\/|$)/, `/${to}`) + window.location.search + window.location.hash);
  }, [path, to]);
  return null;
}

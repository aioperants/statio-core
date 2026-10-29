"use client";
import { useEffect } from "react";
import { announceSignedIn } from "@/lib/auth-client";

export function Announce() {
  useEffect(() => {
    announceSignedIn();
    if (window.opener) setTimeout(() => window.close(), 400);
  }, []);
  return null;
}

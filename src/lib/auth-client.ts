"use client";
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({ plugins: [magicLinkClient()] });

/** Inside an iframe, Google and Microsoft refuse to load, so sign-in opens in a popup. */
export const inIframe = () => typeof window !== "undefined" && window.self !== window.top;

const CHANNEL = "statio-auth";

/** Tell other tabs/frames (the booking page) that sign-in finished. */
export function announceSignedIn() {
  try {
    new BroadcastChannel(CHANNEL).postMessage("signed-in");
  } catch {}
  window.opener?.postMessage("statio:signed-in", window.location.origin);
}

/** Calls `cb` when sign-in finishes in another tab or popup. */
export function onSignedInElsewhere(cb: () => void) {
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = () => cb();
  } catch {}
  const onMessage = (e: MessageEvent) => {
    if (e.origin === window.location.origin && e.data === "statio:signed-in") cb();
  };
  window.addEventListener("message", onMessage);
  window.addEventListener("focus", cb);
  return () => {
    channel?.close();
    window.removeEventListener("message", onMessage);
    window.removeEventListener("focus", cb);
  };
}

"use client";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { removePushDevice, savePushDevice, testPush } from "@/app/[locale]/admin/_actions/push";
import { Bell } from "@/components/icons";

type State = "loading" | "unsupported" | "iphone" | "blocked" | "failed" | "off" | "on";

/** What this device can do: notifications on, off, blocked, or not possible here (iPhone outside the Home Screen app). */
function usePush(publicKey: string) {
  const [state, setState] = useState<State>("loading");
  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) && !matchMedia("(display-mode: standalone)").matches;
        return setState(ios ? "iphone" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await navigator.serviceWorker.getRegistration("/");
      setState((await reg?.pushManager.getSubscription()) ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);
  const turnOn = async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      if ((await Notification.requestPermission()) !== "granted") return setState("blocked");
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64Url(publicKey) }));
      setState((await savePushDevice(sub.toJSON())).ok ? "on" : "failed");
    } catch {
      // e.g. a private window, where browsers don't allow notifications.
      setState("failed");
    }
  };
  const turnOff = async () => {
    const sub = await (await navigator.serviceWorker.getRegistration("/"))?.pushManager.getSubscription();
    if (sub) {
      await removePushDevice(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
  };
  return { state, turnOn, turnOff };
}

/** Account: notifications on this device, with a test. */
export function PushSettings({ publicKey }: { publicKey: string }) {
  const t = useTranslations("admin.push");
  const { state, turnOn, turnOff } = usePush(publicKey);
  const [busy, run] = useTransition();
  const [tested, setTested] = useState<boolean | null>(null);
  if (state === "loading") return null;
  if (state === "unsupported" || state === "iphone" || state === "blocked" || state === "failed") return <p className="text-sm text-muted">{t(state)}</p>;
  return (
    <div className="grid gap-2">
      {state === "on" && <p className="font-medium">✓ {t("onHere")}</p>}
      <div className="flex flex-wrap gap-2">
        {state === "off" ? (
          <button type="button" disabled={busy} className="btn-primary" onClick={() => run(turnOn)}>
            {t("turnOn")}
          </button>
        ) : (
          <>
            <button type="button" disabled={busy} className="btn-ghost" onClick={() => run(async () => setTested((await testPush()).ok))}>
              {t("test")}
            </button>
            <button type="button" disabled={busy} className="btn-ghost" onClick={() => run(turnOff)}>
              {t("turnOff")}
            </button>
          </>
        )}
      </div>
      {tested === false && <p className="text-sm text-red-700">{t("testFailed")}</p>}
    </div>
  );
}


function base64Url(key: string) {
  const raw = atob((key + "=".repeat((4 - (key.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

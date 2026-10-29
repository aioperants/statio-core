"use client";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { cancelByClient } from "./actions";

export function CancelButton({ token }: { token: string }) {
  const t = useTranslations("manage");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      className="btn-danger"
      onClick={() => {
        if (!confirm(t("cancelConfirm"))) return;
        start(async () => {
          await cancelByClient(token);
          router.refresh();
        });
      }}
    >
      {t("cancel")}
    </button>
  );
}

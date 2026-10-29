"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * A message the salon writes in plain words (no {name} or {salon}): the box starts with ours,
 * "Restore our text" puts it back, an empty box means ours. The preview shows exactly what the client
 * gets, with what we add (greeting, details, links, the salon's name) in grey.
 */
export function PlainMessage(props: {
  name: string;
  lang: string;
  label: string;
  hint: string;
  value: string;
  ours: string;
  max: number;
  /** "¡Hola, Laura!" before the text. */
  greeting: string;
  /** What we add after it, one paragraph each (fixed lines, details, link, salon). */
  after: (string | { text: string; strong?: boolean })[];
  previewLabel: string;
  /** Called as they type, for previews outside (e.g. the email). */
  onText?: (text: string) => void;
  children?: React.ReactNode;
}) {
  const t = useTranslations("admin.reviews");
  const [value, setValue] = useState(props.value);
  const set = (v: string) => {
    setValue(v);
    props.onText?.(v);
  };
  const text = (value.trim() ? value : props.ours).slice(0, props.max).trim();
  return (
    <>
      <label className="block">
        <span className="flex items-baseline justify-between gap-2">
          <span className="label">{props.label}</span>
          {value.trim() !== props.ours.trim() && (
            <button type="button" onClick={() => set(props.ours)} className="text-xs font-medium text-brand">
              ↺ {t("restore")}
            </button>
          )}
        </span>
        <textarea name={props.name} lang={props.lang} rows={3} maxLength={props.max} value={value} onChange={(e) => set(e.target.value)} className="field" />
        <span className="mt-1 block text-xs text-muted">{props.hint}</span>
      </label>
      {props.children}
      <details className="rounded-xl bg-canvas p-3 text-sm">
        <summary className="cursor-pointer font-medium">{props.previewLabel}</summary>
        <MessagePreview greeting={props.greeting} text={text} after={props.after} />
      </details>
    </>
  );
}

/** A phone-style bubble: our parts in grey, the salon's words in black. */
export function MessagePreview({ greeting, text, after }: { greeting: string; text: string; after: (string | { text: string; strong?: boolean })[] }) {
  return (
    <p className="mt-2 max-w-sm rounded-2xl rounded-bl-sm bg-white p-3 whitespace-pre-line shadow-sm [overflow-wrap:anywhere]">
      <span className="text-muted">{greeting}</span> {text}
      {after.filter((a) => (typeof a === "string" ? a : a.text)).map((a, i) => (
        <span key={i} className="mt-2 block text-muted">
          {typeof a === "string" ? a : a.text}
        </span>
      ))}
    </p>
  );
}

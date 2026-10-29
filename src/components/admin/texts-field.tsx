import { textIn } from "@/lib/texts";

/**
 * A text the salon writes for its clients, once, in its client language. Posts `<name>.<code>`;
 * a text saved under another language (before the client language changed) is shown to edit.
 */
export function TextsField({
  name,
  label,
  langs,
  values,
  required,
  multiline,
  placeholder,
  maxLength = 500,
}: {
  name: string;
  label: string;
  langs: { code: string; name: string }[];
  values: Record<string, string>;
  required?: boolean;
  multiline?: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  const code = langs[0].code;
  const props = { name: `${name}.${code}`, defaultValue: textIn(values, code), required, maxLength, placeholder, lang: code, className: "field" };
  return (
    <label className="block">
      <span className="label">{label}</span>
      {multiline ? <textarea rows={3} {...props} /> : <input {...props} />}
    </label>
  );
}

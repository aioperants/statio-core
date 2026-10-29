/**
 * "How did you hear about us?": the built-in answers are translated (messages `heard.*`); answers
 * the owner adds are their own words, shown as written.
 */
export const HEARD_BUILT_IN = ["recommended", "social", "google", "walkby", "other"] as const;

export function heardLabel(option: string, t: (key: string) => string) {
  return (HEARD_BUILT_IN as readonly string[]).includes(option) ? t(option) : option;
}

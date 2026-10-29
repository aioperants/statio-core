/**
 * Messages the salon writes in plain words (no {name} or {salon} to learn): we add the greeting with
 * the client's first name, the details and links, and the salon's name. Texts saved before still
 * work: their {name}/{salon} are filled in, and their own "Hi {name}!" opening is dropped so the
 * client isn't greeted twice.
 */

/** "Hi …", "Hello …", "¡Hola …", "Buenas …", up to the first ! . , or : (only at the very start). */
const OPENING = /^\s*¡?\s*(hi|hello|hey|dear|hola|buenas|buenos días|querid[ao])\b[^!.,:\n]{0,40}[!.,:]\s*/i;

export function plainText(text: string, o: { name: string; salon: string }) {
  const rest = text.replace(OPENING, "");
  // "Hi {name}, how was it?" → "How was it?" (a capital after the dropped opening).
  const capital = rest !== text ? rest.charAt(0).toUpperCase() + rest.slice(1) : rest;
  return capital.replaceAll("{name}", o.name).replaceAll("{salon}", o.salon).replace(/\s+\n/g, "\n").trim();
}

/** What the owner sees in the box: a saved text without its old opening, {salon} written out. */
export const plainForEditing = (text: string, salon: string) => text.replace(OPENING, "").replaceAll("{salon}", salon).trim();

/** "¡Hola, Laura!" (from the language's greeting) then the salon's words, on one line. */
export const greeted = (greeting: string, firstName: string, text: string) => [greeting.replaceAll("{name}", firstName).trim(), text.trim()].filter(Boolean).join(" ");

/** The welcome as the client gets it: greeting and the salon's words, the visit details, the salon's name. */
export const welcomeBody = (text: string, visit: string, salon: string) => [text.trim(), visit.trim(), salon.trim()].filter(Boolean).join("\n\n");

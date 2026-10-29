import "server-only";
import { messagesFor } from "@/i18n/messages";

/** The built-in welcome for a new client, in the salon's client language (the salon can write its own). */
export function welcomeDefaults(locale: string) {
  const e = messagesFor(locale).emails as { greeting: string; welcomeDefault: string };
  return { greeting: e.greeting, message: e.welcomeDefault };
}

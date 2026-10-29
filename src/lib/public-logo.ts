import "server-only";
import { db } from "@/db";
import { heroLayout } from "./readiness";

/**
 * The logo clients see (booking page, sign-in, app icon): only with the "Logo and text" website
 * design, the one that uses a logo. With a photo design the salon's name (or its initials) stands
 * in, even if a logo is stored. Runs as the salon.
 */
export async function publicLogo(b: { logo: string | null } | null | undefined): Promise<string | null> {
  if (!b?.logo) return null;
  const site = await db.query.website.findFirst({ columns: { published: true, draft: true } });
  return heroLayout(site?.published ?? site?.draft) === "brand" ? b.logo : null;
}

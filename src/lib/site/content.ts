import type { PieceKey, SiteConfig } from "./config";
import type { SiteData } from "./types";

/** What the salon has filled in, as far as the website's pieces care: enough for the settings screen too. */
export type SiteFacts = {
  services: boolean;
  serviceCount: number;
  team: number;
  hours: boolean;
  contact: boolean;
  /** The business email the Contact section can show. */
  email: string | null;
};

export const siteFacts = (d: SiteData): SiteFacts => ({
  services: d.services.some((g) => g.items.length > 0),
  serviceCount: d.services.reduce((n, g) => n + g.items.length, 0),
  team: d.team.length,
  hours: d.hours.length > 0 || !!d.address,
  contact: !!(d.phone || d.email || d.links.length),
  email: d.email ?? null,
});

/** Whether a section has anything to show. A section without content is left out: nothing is made up. */
export function pieceHasContent(key: PieceKey, config: Pick<SiteConfig, "about" | "faq" | "gallery" | "solo" | "mobile" | "serviceArea">, f: SiteFacts): boolean {
  switch (key) {
    case "hero":
      return true;
    case "services":
      return f.services;
    case "team":
      // One person is the salon itself: their photo and words go in the top section and About.
      return !config.solo && f.team >= 2;
    case "gallery":
      return (config.gallery?.length ?? 0) > 0;
    case "about":
      return config.about.trim().length > 0;
    case "faq":
      return (config.faq?.length ?? 0) > 0;
    case "hours":
      return f.hours || (!!config.mobile && !!config.serviceArea?.trim());
    case "contact":
      return f.contact;
  }
}

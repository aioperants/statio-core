import type { Area, Level } from "@/lib/permissions";

/** Admin navigation: bottom tabs on phones, side menu on tablets and computers (names: ui-revision/terminology.md). */
export const NAV = {
  tabs: [
    { href: "", key: "today" },
    { href: "/calendar", key: "calendar" },
    { href: "/requests", key: "requests" },
    { href: "/clients", key: "clients" },
  ],
  // "Tools": what brings in clients and money. One-time setup lives under Settings.
  more: [
    // Their own tools; people who set up the salon find them under Settings.
    { href: "/equipment", key: "equipment", need: "noSetup" },
    { href: "/settings", key: "settings", need: "setup" },
  ],
} as const;

/** The account menu (click your name; on a phone, in More): the account, security and data. */
export const ACCOUNT = [
  { href: "/account", key: "security", need: null },
  { href: "/settings/activity", key: "activityLog", need: ["team", "full"] },
  { href: "/data", key: "downloadData", need: ["clientData", "view"] },
  { href: "/move", key: "moveToStatio", need: ["settings", "edit"] },
] as const;

/**
 * Settings: how the business works, set once. Six doors, each opening one page that holds
 * its group; `items` are the pages one level deeper.
 * Each door shows to people who may use one of its pages.
 */
export const SETTINGS = [
  {
    key: "business",
    href: "/settings/business",
    items: [
      { href: "/settings/business", key: "business", need: ["settings", "edit"] },
      { href: "/salon", key: "salon", need: ["settings", "edit"] },
      { href: "/settings/hours", key: "hours", need: ["settings", "edit"] },
      { href: "/settings/language", key: "language", need: ["settings", "edit"] },
    ],
  },
  {
    key: "team",
    href: "/staff",
    items: [
      { href: "/staff", key: "staff", need: ["team", "edit"] },
      { href: "/settings/week", key: "week", need: ["team", "view"] },
      { href: "/equipment", key: "equipment", need: ["equipment", "edit"] },
    ],
  },
  {
    key: "services",
    href: "/services",
    items: [
      { href: "/services", key: "services", need: ["services", "edit"] },
      { href: "/services/categories", key: "categories", need: ["services", "edit"] },
      { href: "/chairs", key: "chairs", need: ["settings", "edit"] },
    ],
  },
  {
    key: "booking",
    href: "/rules",
    items: [
      { href: "/rules", key: "rules", need: ["settings", "edit"] },
      { href: "/email", key: "email", need: ["settings", "edit"] },
    ],
  },
  {
    key: "website",
    href: "/settings/website",
    items: [
      { href: "/settings/website", key: "website", need: ["settings", "edit"] },
      { href: "/website/booking-page", key: "bookingPage", need: ["settings", "edit"] },
    ],
  },
  {
    key: "search",
    href: "/settings/found",
    items: [
      { href: "/settings/found", key: "found", need: ["settings", "edit"] },
    ],
  },
] as const;

/**
 * What a menu item needs: an area and level, "setup" (can set something up in Settings),
 * "noSetup" (the opposite: their own things in More instead), or nothing.
 */
export type Need = readonly [Area, Exclude<Level, "none">] | "setup" | "noSetup" | null;
export function canUse(need: Need, can: (area: Area, level: Exclude<Level, "none">) => boolean) {
  const setup = (["settings", "team", "services"] as const).some((a) => can(a, "edit"));
  return need === null ? true : need === "setup" ? setup : need === "noSetup" ? !setup : can(need[0], need[1]);
}

/**
 * Who can do what. Each person has an access level (a ready-made set of permissions) and,
 * optionally, exceptions per area. Every server action and page checks these; screens only hide
 * what a person can't use.
 *
 * Levels, from least to most: none < view < edit < full ("full" also allows deleting).
 * For the calendar, "view" = everyone's calendar read-only plus their own to manage,
 * "edit" / "full" = manage everyone's visits.
 */
export const AREAS = ["calendar", "clients", "clientData", "services", "team", "money", "settings", "equipment"] as const;
export type Area = (typeof AREAS)[number];
export const LEVELS = ["none", "view", "edit", "full"] as const;
export type Level = (typeof LEVELS)[number];

export const ACCESS = ["owner", "manager", "stylist", "frontdesk", "renter"] as const;
export type Access = (typeof ACCESS)[number];

const all = (level: Level) => Object.fromEntries(AREAS.map((a) => [a, level])) as Record<Area, Level>;

/** The ready-made levels. A stylist or renter always manages their own visits and their own clients. */
export const PRESETS: Record<Access, Record<Area, Level>> = {
  owner: all("full"),
  // Everything day to day, but not exporting the client list unless the owner allows it.
  manager: { ...all("full"), clientData: "none", money: "view" },
  // Their own calendar and visits; the salon's clients read-only.
  stylist: { calendar: "none", clients: "view", clientData: "none", services: "view", team: "none", money: "none", settings: "none", equipment: "none" },
  // Reception: everyone's bookings and clients, adds and changes but doesn't delete or export; no takings.
  frontdesk: { calendar: "edit", clients: "edit", clientData: "none", services: "view", team: "view", money: "none", settings: "none", equipment: "none" },
  // Like a stylist; their own clients are fully theirs (see "owns their clients").
  renter: { calendar: "none", clients: "view", clientData: "none", services: "view", team: "none", money: "none", settings: "none", equipment: "none" },
};

const rank = (l: Level) => LEVELS.indexOf(l);
const isLevel = (v: unknown): v is Level => (LEVELS as readonly unknown[]).includes(v);
export const isAccess = (v: unknown): v is Access => (ACCESS as readonly unknown[]).includes(v);

/** Someone's effective permissions: their access level with their exceptions on top. The owner always has everything. */
export function permissionsOf(p: { access: string; permissions?: Record<string, string> | null }): Record<Area, Level> {
  const access = isAccess(p.access) ? p.access : "stylist";
  if (access === "owner") return PRESETS.owner;
  const out = { ...PRESETS[access] };
  for (const [area, level] of Object.entries(p.permissions ?? {})) if ((AREAS as readonly string[]).includes(area) && isLevel(level)) out[area as Area] = level;
  return out;
}

/** Whether the person may do at least `level` in `area`. */
export const allows = (p: { access: string; permissions?: Record<string, string> | null }, area: Area, level: Exclude<Level, "none">) =>
  rank(permissionsOf(p)[area]) >= rank(level);

/** Exceptions only: what differs from the access level, so changing the level later keeps them meaningful. */
export function exceptionsFrom(access: Access, wanted: Partial<Record<Area, Level>>) {
  const out: Record<string, string> = {};
  for (const area of AREAS) if (wanted[area] && wanted[area] !== PRESETS[access][area]) out[area] = wanted[area]!;
  return out;
}

/** Only the owner hands out manager access or exceptions above a manager's. */
export const grantable = (granter: { access: string }, access: Access) => granter.access === "owner" || (access !== "owner" && access !== "manager");

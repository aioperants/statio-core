/**
 * Starting points for a new salon, by type of business: service groups, starter services and
 * stations. Names are app text (messages "templates"), created once in the salon's client
 * language; after that they're the owner's own and can be changed or removed like anything else.
 * Prices start empty and the services start hidden, so nothing is bookable until it's priced.
 */
export const BUSINESS_TYPES = ["hair", "barber", "nails", "beauty", "spa", "laser"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

/** `colour`: keep a colour card and ask for a patch test / allergy check (colour, lash lift). */
type StarterService = { key: string; group: string; minutes: number; rebookDays?: number; station?: string; colour?: boolean };
type StarterStation = { key: string; kind: string; count: number; shared?: boolean };

export const TEMPLATES: Record<BusinessType, { groups: string[]; services: StarterService[]; stations: StarterStation[] }> = {
  hair: {
    groups: ["cuts", "colour", "styling", "treatments"],
    services: [
      { key: "womensCut", group: "cuts", minutes: 45, rebookDays: 42 },
      { key: "mensCut", group: "cuts", minutes: 30, rebookDays: 35 },
      { key: "kidsCut", group: "cuts", minutes: 30, rebookDays: 49 },
      { key: "rootColour", group: "colour", minutes: 90, rebookDays: 42, station: "basin", colour: true },
      { key: "highlights", group: "colour", minutes: 120, rebookDays: 84, station: "basin", colour: true },
      { key: "blowDry", group: "styling", minutes: 30, rebookDays: 7 },
      { key: "updo", group: "styling", minutes: 60 },
      { key: "hairTreatment", group: "treatments", minutes: 45, rebookDays: 42, station: "basin" },
    ],
    stations: [
      { key: "stylingChair", kind: "styling", count: 2 },
      { key: "basin", kind: "basin", count: 1, shared: true },
    ],
  },
  barber: {
    groups: ["cuts", "beard", "shave"],
    services: [
      { key: "haircut", group: "cuts", minutes: 30, rebookDays: 28 },
      { key: "fade", group: "cuts", minutes: 40, rebookDays: 21 },
      { key: "kidsCut", group: "cuts", minutes: 25, rebookDays: 35 },
      { key: "beardTrim", group: "beard", minutes: 20, rebookDays: 14 },
      { key: "cutAndBeard", group: "beard", minutes: 45, rebookDays: 28 },
      { key: "hotTowelShave", group: "shave", minutes: 30, rebookDays: 21 },
    ],
    stations: [{ key: "barberChair", kind: "styling", count: 2 }],
  },
  nails: {
    groups: ["manicure", "pedicure", "nailArt", "lashesBrows"],
    services: [
      { key: "classicManicure", group: "manicure", minutes: 40, rebookDays: 14, station: "nail" },
      { key: "gelManicure", group: "manicure", minutes: 60, rebookDays: 21, station: "nail" },
      { key: "acrylicSet", group: "manicure", minutes: 90, rebookDays: 21, station: "nail" },
      { key: "infill", group: "manicure", minutes: 60, rebookDays: 21, station: "nail" },
      { key: "spaPedicure", group: "pedicure", minutes: 60, rebookDays: 28, station: "pedicure" },
      { key: "gelPedicure", group: "pedicure", minutes: 60, rebookDays: 28, station: "pedicure" },
      { key: "nailArt", group: "nailArt", minutes: 15 },
      { key: "browShape", group: "lashesBrows", minutes: 20, rebookDays: 28 },
      { key: "lashLift", group: "lashesBrows", minutes: 50, rebookDays: 42, colour: true },
    ],
    stations: [
      { key: "nailDesk", kind: "nail", count: 2 },
      { key: "pedicureChair", kind: "pedicure", count: 1, shared: true },
    ],
  },
  beauty: {
    groups: ["face", "waxing", "lashesBrows", "massage"],
    services: [
      { key: "facial", group: "face", minutes: 60, rebookDays: 35, station: "room" },
      { key: "browShape", group: "lashesBrows", minutes: 20, rebookDays: 28 },
      { key: "lashLift", group: "lashesBrows", minutes: 50, rebookDays: 42, colour: true },
      { key: "legWax", group: "waxing", minutes: 45, rebookDays: 35, station: "room" },
      { key: "bikiniWax", group: "waxing", minutes: 20, rebookDays: 35, station: "room" },
      { key: "massage", group: "massage", minutes: 60, rebookDays: 30, station: "room" },
    ],
    stations: [{ key: "treatmentRoom", kind: "room", count: 1, shared: true }],
  },
  spa: {
    groups: ["massage", "face", "body"],
    services: [
      { key: "relaxMassage", group: "massage", minutes: 60, rebookDays: 30, station: "room" },
      { key: "deepMassage", group: "massage", minutes: 60, rebookDays: 30, station: "room" },
      { key: "hotStones", group: "massage", minutes: 75, rebookDays: 42, station: "room" },
      { key: "facial", group: "face", minutes: 60, rebookDays: 35, station: "room" },
      { key: "bodyScrub", group: "body", minutes: 45, rebookDays: 42, station: "room" },
    ],
    stations: [{ key: "treatmentRoom", kind: "room", count: 2 }],
  },
  // Laser hair removal: a consultation and patch test first, then areas in a course of sessions
  // (the face comes back sooner than the body). One room with the machine.
  laser: {
    groups: ["consultation", "face", "body", "men"],
    services: [
      { key: "laserConsultation", group: "consultation", minutes: 20, station: "room" },
      { key: "laserUpperLip", group: "face", minutes: 10, rebookDays: 35, station: "room" },
      { key: "laserFace", group: "face", minutes: 20, rebookDays: 35, station: "room" },
      { key: "laserUnderarms", group: "body", minutes: 15, rebookDays: 42, station: "room" },
      { key: "laserBikini", group: "body", minutes: 15, rebookDays: 42, station: "room" },
      { key: "laserFullBikini", group: "body", minutes: 30, rebookDays: 42, station: "room" },
      { key: "laserArms", group: "body", minutes: 30, rebookDays: 49, station: "room" },
      { key: "laserHalfLegs", group: "body", minutes: 30, rebookDays: 56, station: "room" },
      { key: "laserFullLegs", group: "body", minutes: 60, rebookDays: 56, station: "room" },
      { key: "laserBack", group: "body", minutes: 30, rebookDays: 56, station: "room" },
      { key: "laserMenChestBack", group: "men", minutes: 45, rebookDays: 56, station: "room" },
    ],
    stations: [{ key: "treatmentRoom", kind: "room", count: 1 }],
  },
};

/** One plan for the ticked types: shared groups, services and stations only once (a hair salon and a barbershop share "Cuts"). */
export function templatePlan(types: readonly BusinessType[]) {
  const picked = BUSINESS_TYPES.filter((t) => types.includes(t));
  const groups = [...new Set(picked.flatMap((t) => TEMPLATES[t].groups))];
  const seen = new Set<string>();
  const services = picked.flatMap((t) => TEMPLATES[t].services).filter((s) => !seen.has(s.key) && seen.add(s.key));
  const stations = new Map<string, StarterStation>();
  for (const t of picked) for (const s of TEMPLATES[t].stations) if (!stations.has(s.key)) stations.set(s.key, s);
  return { groups, services, stations: [...stations.values()] };
}

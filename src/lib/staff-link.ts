/**
 * A professional's own booking link: /book?staff=marta. The short name comes from their first name
 * (plus last name, or their id, when two people share it), so links stay readable.
 */
const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function staffSlugs(people: { id: string; name: string; lastName?: string | null }[]) {
  const count = (slug: string) => people.filter((p) => slugify(p.name) === slug).length;
  const full = (p: { name: string; lastName?: string | null }) => slugify([p.name, p.lastName].filter(Boolean).join(" "));
  const out = new Map<string, string>();
  for (const p of people) {
    const first = slugify(p.name);
    const both = full(p);
    const taken = (s: string) => [...out.values()].includes(s);
    out.set(p.id, first && count(first) === 1 ? first : both && !taken(both) && people.filter((q) => full(q) === both).length === 1 ? both : p.id);
  }
  return out;
}

/** The person a ?staff= value points to (their short name or their id). */
export function staffFromSlug<T extends { id: string; name: string; lastName?: string | null }>(people: T[], value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const slugs = staffSlugs(people);
  return people.find((p) => p.id === value || slugs.get(p.id) === value.toLowerCase()) ?? null;
}

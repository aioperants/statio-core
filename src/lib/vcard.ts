/** Text inside a vCard field: backslashes, commas, semicolons and line breaks escaped. */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

/**
 * The salon as a phone contact (vCard 3.0, read by iPhone and Android): its name, phone, email,
 * address, booking link and profiles. "Add to my contacts" on the salon's QR page downloads it.
 */
export function salonVCard(s: {
  name: string;
  phone?: string | null;
  email?: string | null;
  street?: string | null;
  town?: string | null;
  postcode?: string | null;
  country?: string | null;
  address?: string | null;
  bookUrl: string;
  note?: string;
  links?: { label: string; url: string }[];
}) {
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `N:${esc(s.name)};;;;`, `FN:${esc(s.name)}`, `ORG:${esc(s.name)}`];
  if (s.phone) lines.push(`TEL;TYPE=WORK,VOICE:${s.phone.replace(/[^\d+]/g, "")}`);
  if (s.email) lines.push(`EMAIL;TYPE=WORK:${esc(s.email)}`);
  if (s.street || s.town) lines.push(`ADR;TYPE=WORK:;;${esc(s.street ?? "")};${esc(s.town ?? "")};;${esc(s.postcode ?? "")};${esc(s.country ?? "")}`);
  else if (s.address) lines.push(`ADR;TYPE=WORK:;;${esc(s.address)};;;;`);
  lines.push(`URL:${s.bookUrl}`);
  for (const l of s.links ?? []) lines.push(`X-SOCIALPROFILE;TYPE=${esc(l.label.toLowerCase())}:${l.url}`);
  if (s.note) lines.push(`NOTE:${esc(s.note)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n") + "\r\n";
}

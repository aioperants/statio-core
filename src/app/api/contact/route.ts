import { getBusiness } from "@/lib/booking";
import { socialLinks } from "@/lib/found-online";
import { salonUrl } from "@/lib/salon-url";
import { salonVCard } from "@/lib/vcard";

/** The salon as a phone contact (.vcf): "Add to my contacts" on its QR page. The phone offers to save it. */
export async function GET() {
  const b = await getBusiness();
  if (!b?.setupDone) return new Response("Not found", { status: 404 });
  const bookUrl = `${salonUrl()}/${b.defaultLocale}/book`;
  const card = salonVCard({
    name: b.name,
    phone: b.phone,
    email: b.email,
    street: b.addressStreet,
    town: b.addressTown,
    postcode: b.addressPostcode,
    country: b.country,
    address: b.address,
    bookUrl,
    links: socialLinks(b).map((l) => ({ label: l.label, url: l.url })),
  });
  const file = b.name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "contact";
  return new Response(card, {
    headers: {
      "content-type": "text/vcard; charset=utf-8",
      "content-disposition": `inline; filename="${encodeURIComponent(file)}.vcf"; filename*=UTF-8''${encodeURIComponent(file)}.vcf`,
      "cache-control": "no-store",
    },
  });
}

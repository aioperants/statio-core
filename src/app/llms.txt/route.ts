import { currentSalonId } from "@/db";
import { money } from "@/lib/format";
import { publicSite } from "@/lib/site/data";
import { salonUrl } from "@/lib/salon-url";

export const dynamic = "force-dynamic";

/**
 * /llms.txt: the salon in plain text for AI assistants (ChatGPT, Perplexity…), built from the same
 * live details as the website and the booking page. Nothing private: what clients already see.
 */
export async function GET() {
  const id = await currentSalonId();
  const site = id ? await publicSite(id) : null;
  if (!site?.setupDone) return new Response("Not found", { status: 404 });
  const { data, business, config } = site;
  const base = salonUrl();
  const lines: string[] = [`# ${data.name}`, ""];
  const about = config?.tagline || business.about;
  if (about) lines.push(`> ${about.replace(/\s+/g, " ")}`, "");
  if (site.enabled && config?.about) lines.push(config.about, "");
  lines.push(`- Book online: ${base}${data.bookUrl}`);
  if (site.enabled) lines.push(`- Website: ${base}/${data.locale}`);
  if (config?.mobile && site.enabled) {
    if (config.serviceArea) lines.push(`- Comes to clients in: ${config.serviceArea}`);
  } else if (data.address) lines.push(`- Address: ${data.address}`);
  if (data.phoneDisplay) lines.push(`- Phone: ${data.phoneDisplay}`);
  if (data.email) lines.push(`- Email: ${data.email}`);
  for (const l of data.links) lines.push(`- ${l.label}: ${l.url}`);
  if (data.hours.length) lines.push("", "## Opening hours", "", ...data.hours.map((h) => `- ${h.days}: ${h.hours}`));
  if (data.closures.length) lines.push("", "## Closed days coming up", "", ...data.closures.map((c) => `- ${c.when}${c.reason ? ` (${c.reason})` : ""}`));
  if (data.services.length) {
    lines.push("", "## Services and prices");
    const showPrices = config?.showPrices ?? true;
    for (const g of data.services) {
      lines.push("", ...(g.name ? [`### ${g.name}`, ""] : []));
      for (const s of g.items) {
        const price = showPrices && s.priceCents > 0 ? `, ${s.from ? "from " : ""}${money(s.priceCents, data.currency, data.locale)}` : "";
        lines.push(`- ${s.name}: ${s.durationMin} min${price}`);
      }
    }
  }
  if (data.team.length) lines.push("", "## Team", "", ...data.team.map((m) => `- ${m.name}${m.title ? `, ${m.title}` : ""}: ${base}${m.bookUrl}`));
  if (site.enabled && config?.faq.length) lines.push("", "## Questions", "", ...config.faq.flatMap((f) => [`### ${f.q}`, "", f.a, ""]));
  return new Response(lines.join("\n").trim() + "\n", { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });
}

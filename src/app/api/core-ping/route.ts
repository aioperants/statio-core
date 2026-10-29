import { getBusiness } from "@/lib/booking";
import { helloOn, sayHello } from "@/lib/core-hello";

export const dynamic = "force-dynamic";

/**
 * Weekly, from Vercel's cron (vercel.json): "still running", so the Statio team can count active
 * installs. Anonymous (lib/core-hello). Only Vercel's cron may call it: with CRON_SECRET set, Vercel
 * sends it as a bearer token.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const fromCron = secret ? request.headers.get("authorization") === `Bearer ${secret}` : (request.headers.get("user-agent") ?? "").startsWith("vercel-cron/");
  if (!fromCron) return new Response(null, { status: 401 });
  if (!helloOn()) return new Response(null, { status: 204 });
  const business = await getBusiness();
  await sayHello("ping", { country: business?.country ?? null, locale: business?.defaultLocale ?? "en" });
  return new Response(null, { status: 204 });
}

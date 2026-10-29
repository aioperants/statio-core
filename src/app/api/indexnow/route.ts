import { indexNowKey } from "@/lib/indexnow";

/** The IndexNow key file: proves to search engines that the pings come from this site. */
export function GET() {
  return new Response(indexNowKey(), { headers: { "content-type": "text/plain; charset=utf-8" } });
}

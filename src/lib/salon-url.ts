/** The salon's own address (BETTER_AUTH_URL), for links in emails, messages, the sitemap and shared links. */
export function salonUrl(): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

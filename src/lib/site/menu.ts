import type { Piece, PieceKey } from "./config";

/** Sections that get a place in the website's menu (the top doesn't). */
const LISTED: readonly PieceKey[] = ["services", "team", "gallery", "about", "faq", "hours", "contact"];

/** The website's menu (≡): the sections the page actually shows, in page order, each jumping to its place. */
export function menuLinks(pieces: Piece[], shown: (key: PieceKey) => boolean) {
  return pieces.filter((p) => p.on && LISTED.includes(p.key) && shown(p.key)).map((p) => ({ key: p.key, href: `#piece-${p.key}` }));
}

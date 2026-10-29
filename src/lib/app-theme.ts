import "server-only";
import { cache } from "react";
import { db } from "@/db";
import { NEUTRAL, websiteColours, type Colours } from "./app-colours";
import { getBusiness, type Business } from "./booking";
import { readConfig } from "./site/config";

/** The app in the website's colours: its look as published, else as being edited (lib/app-colours.ts). */
export async function websiteAppColours(b: Business): Promise<Colours> {
  const row = await db.query.website.findFirst({ columns: { draft: true, published: true } });
  const config = readConfig(row?.published ?? row?.draft);
  return websiteColours(config.direction, b.brandColor, config.palette);
}

/** The app's colours: black and white during setup and by default; the website's when the owner chose them. */
export const getAppColours = cache(async (): Promise<Colours> => {
  const b = await getBusiness();
  return b?.setupDone && b.appColours === "website" ? websiteAppColours(b) : NEUTRAL;
});

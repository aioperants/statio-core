import { Manrope } from "next/font/google";

/** The website's typeface (lib/site/theme.ts), served from our own address (no requests to Google from visitors). */
const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope", preload: false, display: "swap" });

export const siteFonts = manrope.variable;

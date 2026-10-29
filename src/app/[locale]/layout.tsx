import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { isRtl } from "@/i18n/languages";
import { routing } from "@/i18n/routing";
import { NEUTRAL } from "@/lib/app-colours";
import { getAppColours } from "@/lib/app-theme";
import { getBusiness } from "@/lib/booking";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });

export async function generateMetadata(): Promise<Metadata> {
  const business = await getBusiness();
  const name = business?.name ?? "Bookings";
  return {
    title: { default: name, template: `%s · ${name}` },
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
    icons: { icon: "/api/icon?size=192", apple: "/api/icon?size=180" },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const colours = await getAppColours();
  return { themeColor: colours.brand === NEUTRAL.brand ? "#FFFFFF" : colours.brand, width: "device-width", initialScale: 1, viewportFit: "cover" };
}

/**
 * Words the browser needs on public pages (booking, manage, sign-in…). The admin's words are most of
 * the file and only go to admin screens (admin/layout.tsx); the website needs none in the browser.
 */
const PUBLIC = ["common", "status", "book", "signin", "manage", "join", "heard", "recovery"] as const;

async function publicMessages() {
  const all = (await getMessages()) as Record<string, Record<string, unknown>>;
  const out: Record<string, unknown> = Object.fromEntries(PUBLIC.filter((k) => all[k]).map((k) => [k, all[k]]));
  // Moving a visit from the client's own link uses the admin's time picker.
  out.admin = { newBooking: all.admin?.newBooking };
  return out;
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const colours = await getAppColours();
  return (
    // Set on <html> (the root), where Tailwind's theme colours read them.
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      className={`${inter.variable} ${fraunces.variable}`}
      style={{ ["--brand" as string]: colours.brand, ["--canvas" as string]: colours.canvas }}
    >
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider messages={await publicMessages()}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}

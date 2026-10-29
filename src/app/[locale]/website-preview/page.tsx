import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Site, type SiteT } from "@/components/site/site";
import { siteFonts } from "@/components/site/fonts";
import { getStaffMember } from "@/lib/access";
import { allows } from "@/lib/permissions";
import { draftSite } from "@/lib/site/data";
import { themeFor } from "@/lib/site/theme";
import { EditBridge } from "./edit-bridge";
import { StudioSite } from "./studio-site";
import { PIECES } from "@/lib/site/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** The website as it will look with the draft, for the people who set it up. Never public. */
export default async function WebsitePreview({ params, searchParams }: PageProps<"/[locale]/website-preview">) {
  const { locale } = await params;
  // ?only=services: just that section, for the preview above its settings on a phone.
  // ?edit=1: camera buttons on the pictures (setup and "Your website"); ?highlight=logo|cover|icon points at one.
  // ?studio=1: inside the website editor, drawn in the browser so changes show at once (studio-site.tsx).
  const { only, edit, highlight, studio } = await searchParams;
  setRequestLocale(locale);
  const me = await getStaffMember();
  if (!me || !allows(me, "settings", "edit")) notFound();
  const site = await draftSite();
  if (!site) notFound();
  // The website in the clients' language; the preview note in the owner's own.
  const t = (await getTranslations({ locale: site.data.locale, namespace: "site" })) as unknown as SiteT;
  const ta = await getTranslations("admin.website");
  if (studio === "1") {
    const messages = (await getMessages({ locale: site.data.locale })) as Record<string, unknown>;
    const ts = await getTranslations("admin.website.studio");
    const names = Object.fromEntries([...PIECES.map((k) => [k, k === "about" && site.config.solo ? ta("aboutMe") : ta(`pieces.${k}.name`)]), ["footer", ta("footerRow")]]);
    const empty = Object.fromEntries(PIECES.map((k) => [k, ts(`empty.${k}`)]));
    return (
      <StudioSite
        config={site.config}
        data={site.data}
        messages={messages.site as never}
        fontClass={siteFonts}
        words={{ names, empty, emptyTap: ts("emptyTap"), swipe: ts("swipe"), prev: ts("prevDesign"), next: ts("nextDesign"), example: ta("exampleLabel"), exampleLogo: ta("exampleLogoLabel") }}
      />
    );
  }
  const theme = themeFor(site.config.direction, site.data.brandColor, site.config.palette);
  const editing = edit === "1";
  const tp = await getTranslations("pictures");
  const lit = highlight === "logo" || highlight === "cover" || highlight === "icon" ? highlight : undefined;
  return (
    <>
      <style>{`html,body{background:${theme.bg}}`}</style>
      <Site
        config={site.config}
        data={site.data}
        t={t}
        fontClass={siteFonts}
        previewNote={ta("previewNote")}
        exampleLabel={ta("exampleLabel")}
        exampleLogoLabel={ta("exampleLogoLabel")}
        only={typeof only === "string" ? only : undefined}
        edit={
          editing
            ? {
                cover: { label: tp(site.data.heroImage ? "changeCover" : "addCover"), size: { photo: tp("coverSize"), split: tp("coverSizeSplit") }, required: tp("required") },
                logo: { add: tp("addLogo"), change: tp("changeLogo"), size: tp("logoSize"), required: tp("required"), optional: tp("optional") },
                team: { label: tp("teamPhoto"), size: tp("teamSize") },
                highlight: lit,
              }
            : undefined
        }
      />
      {editing && (
        <>
          <EditBridge />
        </>
      )}
    </>
  );
}

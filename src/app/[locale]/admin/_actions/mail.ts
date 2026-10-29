"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { audit, getSession, requirePermission } from "@/lib/access";
import { deliver, mailConfig } from "@/lib/email";
import { seal } from "@/lib/secret-box";

const text = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

/** Save Settings › Email. Leaving a password or key empty keeps the saved one. */
export async function saveMail(locale: string, form: FormData) {
  const me = await requirePermission("settings", "edit");
  const provider = z.enum(["env", "none", "resend", "smtp"]).parse(form.get("provider"));
  if (provider === "env") {
    await db.delete(schema.mailSettings);
  } else {
    const old = await db.query.mailSettings.findFirst();
    const from = text(form.get("from"));
    if (from) z.email().parse(from);
    const resendKey = text(form.get("resendKey"));
    const smtpPass = text(form.get("smtpPass"));
    const values = {
      provider,
      fromAddress: from,
      resendKeyEnc: resendKey ? seal(resendKey) : (old?.resendKeyEnc ?? null),
      smtpHost: text(form.get("smtpHost")),
      smtpPort: z.coerce.number().int().min(1).max(65535).catch(587).parse(form.get("smtpPort")),
      smtpUser: text(form.get("smtpUser")),
      smtpPassEnc: smtpPass ? seal(smtpPass) : (old?.smtpPassEnc ?? null),
      updatedAt: new Date(),
    };
    await db.insert(schema.mailSettings).values(values).onConflictDoUpdate({ target: schema.mailSettings.businessId, set: values });
  }
  await audit(me.userId, "mail.update", provider);
  revalidatePath("/[locale]/admin", "layout");
  redirect(`/${locale}/admin/email?saved=1`);
}

/** Send a test email to the signed-in person with the saved settings; returns the provider's error if any. */
export async function testMail(): Promise<{ ok: boolean; to: string; error?: string }> {
  await requirePermission("settings", "edit");
  const session = await getSession();
  const to = session!.user.email;
  try {
    const config = await mailConfig();
    if (config.provider === "log") return { ok: false, to, error: "off" };
    await deliver(config, { to, subject: "Statio CRM ✓", text: "Email works. / El email funciona." });
    return { ok: true, to };
  } catch (err) {
    return { ok: false, to, error: (err as Error).message };
  }
}


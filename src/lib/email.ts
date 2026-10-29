import nodemailer from "nodemailer";
import { Resend } from "resend";
import { db, schema } from "@/db";
import { open } from "./secret-box";

interface Email {
  to: string;
  subject: string;
  text: string;
  /** A simple designed version (with a button); `text` stays as the plain part. */
  html?: string;
  template: string;
  appointmentId?: string;
  clientId?: string;
  attachments?: { filename: string; content: string; contentType: string }[];
}

export type Provider = "resend" | "smtp" | "log";

/** Everything needed to send: from Settings › Email, or else the server's environment variables. */
export interface MailConfig {
  provider: Provider;
  /** Sending address, e.g. citas@salon.com; the salon's name is added as the sender name. */
  from: string | null;
  resendKey?: string | null;
  smtp?: { url?: string; host?: string; port: number; user?: string; pass?: string };
}

/**
 * Which service the environment variables point to. EMAIL_PROVIDER picks one; otherwise the first
 * configured: Resend (RESEND_API_KEY), then any SMTP server (SMTP_HOST or SMTP_URL): the salon's own
 * mailbox, Brevo, Postmark, Amazon SES, Mailgun… Without either, emails are printed to the server log.
 */
export function emailProvider(env: Record<string, string | undefined> = process.env): Provider {
  const wanted = env.EMAIL_PROVIDER?.toLowerCase();
  if (wanted === "resend" || wanted === "smtp" || wanted === "log") return wanted;
  if (env.RESEND_API_KEY) return "resend";
  if (env.SMTP_HOST || env.SMTP_URL) return "smtp";
  return "log";
}

export function envMailConfig(env: Record<string, string | undefined> = process.env): MailConfig {
  return {
    provider: emailProvider(env),
    from: env.EMAIL_FROM?.replace(/^.*<(.+)>\s*$/, "$1") ?? null,
    resendKey: env.RESEND_API_KEY,
    smtp: { url: env.SMTP_URL, host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 587), user: env.SMTP_USER, pass: env.SMTP_PASS },
  };
}

/** Settings › Email wins over the environment once the owner has saved it. */
export async function mailConfig(): Promise<MailConfig> {
  const row = await db.query.mailSettings.findFirst();
  if (!row) return envMailConfig();
  if (row.provider === "resend") return { provider: "resend", from: row.fromAddress, resendKey: open(row.resendKeyEnc) };
  if (row.provider === "smtp") {
    return {
      provider: "smtp",
      from: row.fromAddress ?? row.smtpUser,
      smtp: { host: row.smtpHost ?? undefined, port: row.smtpPort ?? 587, user: row.smtpUser ?? undefined, pass: open(row.smtpPassEnc) ?? undefined },
    };
  }
  return { provider: "log", from: null };
}

const EMAIL_CREDIT = "Statio CRM · https://statiocrm.com · created by aioperants.com";
const EMAIL_CREDIT_HTML =
  '<p style="margin-top:24px;font-size:12px;color:#888">Statio CRM · <a href="https://statiocrm.com" style="color:#888">statiocrm.com</a> · created by <a href="https://aioperants.com" style="color:#888">aioperants.com</a></p>';

/** Sends with `config`, from the salon's name; throws with the provider's reason when it fails. */
export async function deliver(config: MailConfig, email: Omit<Email, "template" | "appointmentId">, override?: { replyTo?: string }) {
  // Statio Core's credit, under every email the salon sends (the same in every language).
  email = { ...email, text: `${email.text}\n\n--\n${EMAIL_CREDIT}`, ...(email.html && { html: `${email.html}${EMAIL_CREDIT_HTML}` }) };
  if (config.provider === "log") {
    // In production the log is read by more people than the inbox: keep links that sign someone in out of it.
    const text = process.env.NODE_ENV === "production" ? email.text.replace(/https?:\/\/\S+/g, "[link]") : email.text;
    console.log(`\n[email] to=${email.to}\nsubject: ${email.subject}\n${text}\n${email.attachments?.map((a) => `[attached ${a.filename}]\n`).join("") ?? ""}`);
    return "logged";
  }
  // The salon's name shows as the sender and replies go to the salon.
  const business = await db.query.business.findFirst({ columns: { name: true, email: true } });
  const address = config.from || (config.provider === "smtp" ? config.smtp?.user : "onboarding@resend.dev");
  if (!address) throw new Error("No sending address");
  const from = `${(business?.name ?? "Bookings").replace(/["<>\r\n]/g, "")} <${address}>`;
  const replyTo = override?.replyTo ?? (business?.email && business.email !== address ? business.email : undefined);
  if (config.provider === "resend") {
    if (!config.resendKey) throw new Error("No Resend API key");
    const { error } = await new Resend(config.resendKey).emails.send({
      from,
      replyTo,
      to: email.to,
      subject: email.subject,
      text: email.text,
      ...(email.html && { html: email.html }),
      attachments: email.attachments?.map((a) => ({ ...a, content: Buffer.from(a.content) })),
    });
    if (error) throw new Error(error.message);
    return "sent";
  }
  const s = config.smtp;
  if (!s?.url && !s?.host) throw new Error("No SMTP server");
  const transport = s.url
    ? nodemailer.createTransport(s.url)
    : nodemailer.createTransport({
        host: s.host,
        port: s.port,
        // 465 = encrypted from the start; 587 upgrades with STARTTLS.
        secure: s.port === 465,
        auth: s.user ? { user: s.user, pass: s.pass } : undefined,
        // Never wait long on a slow mail server.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
      });
  await transport.sendMail({ from, replyTo, to: email.to, subject: email.subject, text: email.text, html: email.html, attachments: email.attachments });
  return "sent";
}

/** Sign-in and account emails: like any other email, but not kept in the email history. */
export async function sendAccountEmail(email: Omit<Email, "appointmentId" | "clientId">, override?: { replyTo?: string }): Promise<boolean> {
  try {
    await deliver(await mailConfig(), email, override);
    return true;
  } catch (err) {
    console.error("Sign-in email failed:", (err as Error).message);
    return false;
  }
}

/** Sends through the configured provider (or the server log), and records the result. */
export async function sendEmail(email: Email): Promise<boolean> {
  let status: string;
  try {
    status = await deliver(await mailConfig(), email);
  } catch (err) {
    status = `failed: ${(err as Error).message}`;
  }
  await db
    .insert(schema.messageLog)
    .values({ channel: "email", template: email.template, to: email.to, status, appointmentId: email.appointmentId, clientId: email.clientId })
    .catch(() => undefined);
  return !status.startsWith("failed");
}

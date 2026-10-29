"use server";
import { and, eq, gt } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db, schema } from "@/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/access";

/**
 * From a personal invite: the staff member chooses their own password. The invite link is what
 * proves it's them, so their email counts as confirmed. Then they're signed in.
 */
export async function joinWithPassword(token: string, form: FormData): Promise<{ ok: true } | { ok: false; error: "expired" | "short" | "mismatch" }> {
  const password = String(form.get("password") ?? "");
  if (password.length < 10 || password.length > 128) return { ok: false, error: "short" };
  if (password !== String(form.get("repeat") ?? "")) return { ok: false, error: "mismatch" };
  const person = /^[A-Za-z0-9_-]{20,64}$/.test(token)
    ? await db.query.staff.findFirst({ where: and(eq(schema.staff.inviteToken, token), eq(schema.staff.active, true), gt(schema.staff.inviteExpiresAt, new Date())) })
    : null;
  if (!person?.email) return { ok: false, error: "expired" };
  const email = z.email().parse(person.email.toLowerCase());

  const ctx = await auth.$context;
  const found = await ctx.internalAdapter.findUserByEmail(email, { includeAccounts: true });
  const user = found?.user ?? (await ctx.internalAdapter.createUser({ email, name: [person.name, person.lastName].filter(Boolean).join(" "), emailVerified: true }, { method: "email-password" }));
  if (found && !found.user.emailVerified) await ctx.internalAdapter.updateUser(user.id, { emailVerified: true });
  const hash = await ctx.password.hash(password);
  if (found?.accounts.some((a) => a.providerId === "credential")) await ctx.internalAdapter.updatePassword(user.id, hash);
  else await ctx.internalAdapter.linkAccount({ userId: user.id, providerId: "credential", accountId: user.id, password: hash });

  // Linked to their staff profile; the invite has done its job.
  await db.update(schema.staff).set({ userId: user.id, inviteToken: null, inviteExpiresAt: null }).where(eq(schema.staff.id, person.id));
  await audit(user.id, "staff.joined", [person.name, person.lastName].filter(Boolean).join(" "));
  await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
  return { ok: true };
}

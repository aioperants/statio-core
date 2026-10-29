import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { db, schema } from "@/db";
import { sendAccountEmail } from "./email";

const embedOrigins = (process.env.EMBED_ALLOWED_ORIGINS ?? "").split(/\s+/).filter(Boolean);

const socialProviders: Parameters<typeof betterAuth>[0]["socialProviders"] = {};
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    prompt: "select_account",
  };
}
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  socialProviders.microsoft = {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    tenantId: "common",
  };
}

export const enabledProviders = {
  google: Boolean(socialProviders.google),
  microsoft: Boolean(socialProviders.microsoft),
};

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification, rateLimit: schema.rateLimit },
  }),
  // The salon's own address (BETTER_AUTH_URL) and the websites allowed to embed its booking page.
  trustedOrigins: embedOrigins,
  socialProviders,
  // Staff may also sign in with a password they chose from their invite. Nobody can sign up with a
  // password on their own: accounts with one are only made from a personal invite (see join).
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 10, maxPasswordLength: 128 },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // clients stay signed in for 30 days
    updateAge: 60 * 60 * 24,
  },
  // An account only exists for an email someone has proved is theirs: Microsoft can hand over an email
  // it never checked, which would otherwise let a stranger make the account first.
  account: { accountLinking: { enabled: true, trustedProviders: ["google"], requireLocalEmailVerified: true } },
  databaseHooks: {
    user: { create: { before: async (user) => (user.emailVerified ? undefined : false) } },
  },
  // Sign-in links go to any email typed in: a few a minute per person, so nobody can flood an inbox.
  // Counted in the database, so every server counts together (in memory, each Vercel server counts alone).
  rateLimit: { enabled: true, storage: "database", window: 60, max: 30, customRules: { "/sign-in/magic-link": { window: 60, max: 3 } } },
  plugins: [
    magicLink({
      expiresIn: 60 * 15,
      sendMagicLink: async ({ email, url }) => {
        await sendAccountEmail({
          to: email,
          template: "magic_link",
          subject: "Your sign-in link / Tu enlace de acceso",
          text: `Sign in / Accede: ${url}\n\nThis link expires in 15 minutes. / Este enlace caduca en 15 minutos.`,
        });
      },
    }),
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;

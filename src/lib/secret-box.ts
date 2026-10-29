import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** Encrypts small secrets (email passwords, API keys) for the database, with a key derived from BETTER_AUTH_SECRET. */
const key = () => {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  return createHash("sha256").update(`secret-box:${secret}`).digest();
};

export function seal(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

/** null when the value can't be opened (e.g. BETTER_AUTH_SECRET changed): the owner re-enters it. */
export function open(sealed: string | null | undefined) {
  if (!sealed) return null;
  try {
    const raw = Buffer.from(sealed, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

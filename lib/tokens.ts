import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

// Response-link tokens. The raw token travels in the SMS URL; only its hash is
// stored, so a database read cannot reconstruct a working link.
export function generateToken(): { token: string; tokenHash: string } {
  const token = randomBytes(24).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenMatches(token: string, tokenHash: string): boolean {
  const a = Buffer.from(hashToken(token));
  const b = Buffer.from(tokenHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

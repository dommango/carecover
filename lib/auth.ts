import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

// Single-admin auth. There are no user accounts — a correct password mints a
// signed session cookie. The cookie payload is a constant, signed with
// SESSION_SECRET, so it cannot be forged without the secret.
const COOKIE_NAME = "cc_admin";
const SESSION_VALUE = "admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function sign(value: string): string {
  const sig = createHmac("sha256", env.SESSION_SECRET).update(value).digest("base64url");
  return `${value}.${sig}`;
}

function verify(signed: string): boolean {
  const idx = signed.lastIndexOf(".");
  if (idx <= 0) return false;
  const value = signed.slice(0, idx);
  return value === SESSION_VALUE && constantTimeEqual(signed, sign(value));
}

export function checkAdminPassword(input: string): boolean {
  return constantTimeEqual(input, env.ADMIN_PASSWORD);
}

export async function createAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, sign(SESSION_VALUE), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.APP_BASE_URL.startsWith("https"),
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroyAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const value = jar.get(COOKIE_NAME)?.value;
  return value ? verify(value) : false;
}

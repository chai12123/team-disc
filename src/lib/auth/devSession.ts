import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Dev login (ใช้เมื่อยังไม่มี Supabase Auth): cookie ที่เซ็นด้วย HMAC
 * ไม่ใช่ระบบ auth สำหรับ production
 */
export const DEV_COOKIE = "tf_dev_user";

function secret(): string {
  return env.appSecret || "insecure-dev-secret";
}

export function signDevSession(userId: string, ttlSeconds = 60 * 60 * 24 * 7): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${userId}.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyDevSession(value: string | undefined | null): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const expected = createHmac("sha256", secret()).update(`${userId}.${expStr}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(expStr) < Math.floor(Date.now() / 1000)) return null;
  if (!/^[0-9a-f-]{36}$/.test(userId)) return null;
  return userId;
}

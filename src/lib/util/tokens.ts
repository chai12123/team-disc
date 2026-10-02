import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** สร้าง token สุ่มปลอดภัย (256 บิต, base64url) สำหรับลิงก์ผู้สมัคร */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** เก็บเฉพาะ hash ของ token ในฐานข้อมูล */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function looksLikeToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{32,128}$/.test(token);
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** รหัสผู้สมัครแบบอ่านง่าย เช่น C-7K3Q (ไม่ใช้ตัวที่สับสน) */
export function generateCandidateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const buf = randomBytes(4);
  let out = "";
  for (let i = 0; i < 4; i++) out += alphabet[buf[i] % alphabet.length];
  return `C-${out}`;
}

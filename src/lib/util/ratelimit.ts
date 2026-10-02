import { getSql } from "@/lib/db/client";
import { ApiError } from "./http";

/**
 * Rate limit แบบ fixed window เก็บในฐานข้อมูล (ใช้ได้ข้าม instance บน Vercel)
 * key ควรไม่มีข้อมูลส่วนตัวเต็มรูป เช่น ใช้ IP ที่ตัดทอน หรือ hash
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const sql = getSql();
  const rows = await sql<{ count: number }[]>`
    insert into rate_limits (key, count, window_start)
    values (${key}, 1, now())
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then now() else rate_limits.window_start end
    returning count
  `;
  if (rows[0] && rows[0].count > limit) {
    throw new ApiError(429, "ส่งคำขอถี่เกินไป กรุณาลองใหม่ภายหลัง", "rate_limited");
  }
}

export function ipKey(ip: string): string {
  // ตัดทอน IP เพื่อลดการเก็บข้อมูลระบุตัวตน
  if (ip.includes(":")) return ip.split(":").slice(0, 4).join(":");
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.${parts[2]}.0` : ip;
}

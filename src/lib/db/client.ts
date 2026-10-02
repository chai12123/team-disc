import postgres from "postgres";
import { env } from "@/lib/env";

/**
 * การเชื่อมต่อฐานข้อมูลฝั่ง server (postgres.js)
 * - ใช้ DATABASE_URL (Supabase: connection string จาก Project Settings → Database)
 * - การตรวจสิทธิ์องค์กรทำในโค้ด service ทุก endpoint; RLS ป้องกันการเข้าถึงตรงผ่าน client
 */
declare global {
  var __teamfitSql: ReturnType<typeof postgres> | undefined;
}

export function getSql() {
  if (!globalThis.__teamfitSql) {
    const url = env.databaseUrl;
    if (!url) throw new Error("DATABASE_URL ยังไม่ได้ตั้งค่า (ดู .env.example)");
    globalThis.__teamfitSql = postgres(url, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false, // รองรับ Supabase transaction pooler
      onnotice: () => {},
      transform: postgres.camel,
    });
  }
  return globalThis.__teamfitSql;
}

export type Sql = ReturnType<typeof getSql>;

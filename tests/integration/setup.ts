import { runMigrations } from "@/lib/db/migrate";

/** ตั้งค่า env สำหรับ integration tests และเตรียมฐานข้อมูลทดสอบ (ว่างเปล่า) */
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://postgres@127.0.0.1:54329/teamfit_test";
process.env.AUTH_MODE = "dev";
process.env.APP_SECRET = "test-secret";
process.env.AI_PROVIDER = "demo";
delete process.env.ANTHROPIC_API_KEY;

export async function setup() {
  await runMigrations(process.env.DATABASE_URL!);
}

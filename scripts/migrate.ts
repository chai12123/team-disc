/** ใช้: npm run db:migrate (อ่าน DATABASE_URL จาก .env.local หรือ .env) */
import { config } from "dotenv";
import { runMigrations } from "../src/lib/db/migrate";

config({ path: ".env.local" });
config();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("ไม่พบ DATABASE_URL (ตั้งค่าใน .env.local)");
  process.exit(1);
}
runMigrations(url, console.log)
  .then(() => console.log("migrations: done"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

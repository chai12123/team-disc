import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

/** รัน SQL migrations ใน supabase/migrations ตามลำดับชื่อไฟล์ (รันซ้ำได้) */
export async function runMigrations(databaseUrl: string, log: (s: string) => void = () => {}) {
  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await sql`create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )`;
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      const applied = await sql`select 1 from schema_migrations where name = ${file}`;
      if (applied.length > 0) {
        log(`skip    ${file}`);
        continue;
      }
      const body = fs.readFileSync(path.join(dir, file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into schema_migrations (name) values (${file})`;
      });
      log(`applied ${file}`);
    }
  } finally {
    await sql.end();
  }
}

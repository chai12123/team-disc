# TeamFit (MVP)

เว็บแอปต้นแบบสำหรับองค์กรที่ต้องการ **สร้างโปรไฟล์พฤติกรรมที่บทบาทงานต้องการ** ส่งลิงก์ให้ผู้สมัครทำแบบประเมิน และดูผลพร้อมเปรียบเทียบผู้สมัครหลายคน
เป็นเครื่องมือช่วยสนทนาและทำความเข้าใจการทำงานร่วมกัน **ไม่ตัดสินรับหรือปฏิเสธผู้สมัครอัตโนมัติ**

> MVP นี้ยังไม่ได้ผ่าน psychometric validation สูตร alignment เป็น heuristic ของผลิตภัณฑ์ ก่อนนำไปใช้เป็นเครื่องมือคัดเลือกที่มีผลต่อการจ้างจริง ต้องตรวจ job relevance, reliability, validity และ fairness รวมถึงเปรียบเทียบกับหลักฐานทักษะและผลการทำงาน — ดู [docs/SCORING.md](docs/SCORING.md)

## เริ่มต้นใช้งานในเครื่อง

ต้องมี Node.js 20+ และ Postgres (ท้องถิ่น หรือ Supabase)

```bash
npm install
cp .env.example .env.local        # เติม DATABASE_URL อย่างน้อยหนึ่งค่า (ดูคำอธิบายในไฟล์)
npm run db:migrate                # รัน SQL migrations (รันซ้ำได้)
npm run db:seed                   # demo data: 2 องค์กร 3 ตำแหน่ง ผู้สมัคร 8 คน
npm run dev                       # http://localhost:3000
```

เข้าสู่ระบบ (เมื่อ `AUTH_MODE=dev`): หน้า `/login` มีปุ่มบัญชี demo เช่น `admin@demo.teamfit.local`
ลิงก์ผู้สมัครตัวอย่างพิมพ์ออกมาตอน seed หรือสร้างใหม่ได้ที่แท็บ "ลิงก์สมัคร" ของแต่ละตำแหน่ง (เปิดในหน้าต่างไม่ระบุตัวตนเพื่อแยกจากบัญชีองค์กร)

รีเซ็ต demo data: `npm run db:reset-demo` (ลบเฉพาะองค์กรที่ `is_demo = true` ไม่แตะข้อมูลจริง)

ใช้ Postgres ท้องถิ่นแบบไม่ต้องติดตั้งอะไรเพิ่ม (ถ้ามี `initdb`):
```bash
initdb -D .pgdata -U postgres --auth=trust && pg_ctl -D .pgdata -o "-p 5432" start
createdb -h 127.0.0.1 -U postgres teamfit
# DATABASE_URL=postgresql://postgres@127.0.0.1:5432/teamfit
```

## โหมดการทำงาน

| ส่วน | เมื่อยังไม่ตั้งค่า | เมื่อตั้งค่าแล้ว |
|---|---|---|
| AI | **Demo mode**: scripted adapter ติดป้ายชัดเจนทุกหน้า ไม่แอบอ้างว่าเป็น AI จริง | `ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL` → Claude ผ่าน Anthropic API (เรียกจาก server เท่านั้น, structured output + zod validation) |
| Auth องค์กร | **Dev login** (cookie เซ็นด้วย `APP_SECRET`, เฉพาะ non-production) | `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` และ `AUTH_MODE=supabase` → Supabase Auth (อีเมล/รหัสผ่าน) |
| ฐานข้อมูล | ต้องมี `DATABASE_URL` เสมอ (ห้ามใช้ localStorage) | Supabase Postgres หรือ Postgres อื่น |

เปลี่ยน provider ได้ด้วย env อย่างเดียว (`src/lib/ai/index.ts` คือจุดเชื่อมต่อเดียว)

## สคริปต์

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:migrate` | รัน `supabase/migrations/*.sql` ตามลำดับ บันทึกใน `schema_migrations` |
| `npm run db:seed` / `db:reset-demo` | สร้าง / สร้างใหม่ demo data |
| `npm test` | unit + integration tests (vitest, ต้องมี Postgres ทดสอบ: ค่าเริ่มต้น `postgresql://postgres@127.0.0.1:54329/teamfit_test` หรือกำหนด `TEST_DATABASE_URL`) |
| `npm run test:e2e` | Playwright flow ครบวงจรต่อ dev server ที่รันอยู่และ seed แล้ว (ตั้ง `PW_CHROMIUM_PATH` ได้ถ้าไม่อยากดาวน์โหลด browser) |
| `npm run lint` / `typecheck` | ESLint / tsc |

## โครงสร้าง

```
src/lib/model        8 แกน, schema โปรไฟล์เป้าหมาย (zod), เวอร์ชัน
src/lib/assessment   item bank 64 ข้อ (server-only), ลำดับแสดงผล, ข้อมูลที่ส่งให้ผู้สมัคร
src/lib/scoring      scoring engine (pure functions) — คะแนนรายแกน, alignment, response quality
src/lib/ai           adapter interface, ClaudeAdapter, DemoAdapter, prompts, schemas ของ JSON จาก AI
src/lib/services     business logic ที่ตรวจสิทธิ์องค์กร/ token ทุกจุด
src/lib/auth         Supabase Auth + dev login, บริบทองค์กร
src/app/app/*        หน้าองค์กร (dashboard, roles, discovery, profile, invitations, candidates, compare, sessions, settings, methodology)
src/app/a/[token]    หน้าเริ่มของผู้สมัคร (consent)   ·   src/app/s/[token]  ทำแบบประเมิน / รายงานของตน
src/app/api/*        route handlers (JSON) — ตรวจสิทธิ์บน server ทุก endpoint
supabase/migrations  SQL schema + RLS
scripts              migrate.ts, seed.ts
tests                unit, integration (Postgres จริง), e2e (Playwright)
docs                 SCORING.md, TESTING.md, DEPLOY.md, STATUS.md
```

## Deploy บน Vercel + Supabase

ดู [docs/DEPLOY.md](docs/DEPLOY.md)

## เอกสาร

- [docs/SCORING.md](docs/SCORING.md) — โมเดล 8 แกน สูตรคะแนน ข้อจำกัด
- [docs/TESTING.md](docs/TESTING.md) — สิ่งที่ทดสอบอัตโนมัติแล้ว + ขั้นตอนทดสอบด้วยตนเอง
- [docs/STATUS.md](docs/STATUS.md) — สิ่งที่ยังเป็น demo หรือยังไม่พร้อมใช้จริง

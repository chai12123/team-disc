# Deploy: Vercel + Supabase

## 1) Supabase
1. สร้างโปรเจกต์ที่ https://supabase.com/dashboard
2. **Project Settings → Database → Connection string → URI** เลือก *Transaction pooler* (port 6543) และเติม `?sslmode=require` → ใช้เป็น `DATABASE_URL`
3. **Project Settings → API**: `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`, `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Authentication → Providers → Email**: เปิด Email/Password (ปิด "Confirm email" ได้ในช่วงทดลอง) และตั้ง **Authentication → URL Configuration → Site URL / Redirect URLs** เป็น URL ของแอป (`https://<app>.vercel.app/auth/callback`)
5. รัน migrations จากเครื่องคุณ: `DATABASE_URL=... npm run db:migrate` (ไฟล์ใน `supabase/migrations` รันซ้ำได้ และเปิด RLS ทุกตาราง) — ถ้าใช้ Supabase CLI ก็ `supabase db push` ได้เช่นกัน
6. (ไม่บังคับ) `DATABASE_URL=... npm run db:seed` เพื่อใส่ demo data บนโปรเจกต์ทดลอง

หมายเหตุด้านสิทธิ์: แอปเชื่อมต่อฐานข้อมูลด้วย connection string ฝั่ง server และ **ตรวจสิทธิ์องค์กร/ token ในโค้ดทุก endpoint**; RLS ที่เปิดไว้ป้องกันการเข้าถึงตรงผ่าน Supabase client (anon/authenticated) เพิ่มอีกชั้น ไม่มี API key ใดถูกส่งไป browser นอกจาก anon key ของ Supabase Auth

## 2) Anthropic
1. https://platform.claude.com → **API Keys → Create Key** → `ANTHROPIC_API_KEY`
2. ตั้ง `ANTHROPIC_MODEL` เป็นชื่อรุ่นปัจจุบันจากเอกสาร (เช่น `claude-opus-5-5`) เปลี่ยนรุ่นได้โดยไม่แก้โค้ด
3. ถ้าไม่ตั้งค่า แอปจะทำงานใน Demo mode (scripted) และติดป้ายชัดเจน

## 3) Vercel
1. Import repo → Framework: Next.js
2. Environment Variables (ทุก environment):
   - `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `AUTH_MODE=supabase`
   - `APP_SECRET` (สุ่ม: `openssl rand -hex 32`)
   - `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `AI_TIMEOUT_MS=60000`
   - `NEXT_PUBLIC_APP_URL=https://<app>.vercel.app`
3. Deploy → เปิด `/login` สมัครบัญชีแรก → ระบบพาไป `/onboarding` เพื่อสร้างองค์กร (ผู้สร้างเป็น Organization Admin)

ข้อควรระวัง: ห้ามตั้ง `AUTH_MODE=dev` บน production (โค้ดจะบังคับใช้ Supabase เมื่อมีค่าครบ และต้องตั้ง `ALLOW_DEV_AUTH_IN_PRODUCTION=1` อย่างชัดเจนจึงจะเปิด dev login ได้)

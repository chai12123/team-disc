@AGENTS.md

# TeamFit — project notes
- อ่าน `README.md`, `docs/SCORING.md`, `docs/STATUS.md` ก่อนแก้โค้ด
- การคำนวณคะแนนอยู่ที่ `src/lib/scoring` เท่านั้น; AI (`src/lib/ai`) ห้ามสร้าง/แก้คะแนน
- ทุก route/page ตรวจสิทธิ์องค์กรหรือ token ผ่าน `src/lib/services/*` และ `src/lib/auth/server.ts`
- รันเทสต์: `npm test` (ต้องมี Postgres ทดสอบ), `npm run test:e2e` (ต่อ dev server ที่ seed แล้ว)

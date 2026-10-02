# สถานะความพร้อม: อะไรใช้จริงได้ อะไรยังเป็น demo

## ใช้งานได้จริงแล้ว (ตรวจด้วย automated tests + e2e)
- ฐานข้อมูล Postgres/Supabase, migrations รันซ้ำได้, RLS เปิดทุกตาราง
- Scoring engine ตามสูตร (ข้อกลับคะแนน, คะแนนรายแกน, alignment ถ่วงน้ำหนัก, validation, response quality)
- Role discovery → โปรไฟล์เป้าหมาย (schema validation, clamp, แก้โดยมนุษย์, ยืนยัน/freeze เวอร์ชัน)
- ลิงก์กลาง/เฉพาะบุคคล (token hash, หมดอายุ, เพิกถอน), session token แยกจาก invite token
- แบบประเมิน 64 ข้อ: autosave (debounce + sendBeacon ตอนปิดหน้า), กลับมาทำต่อข้ามอุปกรณ์ด้วยลิงก์, ป้องกัน submit ซ้ำ, ไม่เติมคำตอบแทน
- รายงานผู้สมัคร / รายงานองค์กร / เปรียบเทียบ 2–4 คน (small multiples, overlay ≤ 3, ซ่อนชื่อ, ตรวจเวอร์ชัน) / CSV (กัน formula injection) / print
- ตั้งค่าองค์กร: retention, คำขอลบจากผู้สมัคร, ลบข้อมูล, สมาชิก, audit events, rate limit แบบ DB
- Claude adapter: structured output + zod, timeout/schema/refusal handling (ทดสอบกับ API จำลอง)

## ยังเป็น demo หรือยังไม่ได้ยืนยันกับบริการจริงในสภาพแวดล้อมนี้
- **AI**: ในเครื่องพัฒนานี้ไม่มี `ANTHROPIC_API_KEY` จึงรันด้วย Demo adapter (สคริปต์ 13 คำถาม + รายงานจากแม่แบบ) ทุกหน้าติดป้าย "Demo mode"; เมื่อใส่ key จะสลับเป็น Claude อัตโนมัติ แต่ **ยังไม่ได้ทดสอบกับ API จริง** — ควรลองคุย 1 รอบและดูว่าผลผ่าน schema (ถ้าไม่ผ่าน UI จะแสดง error พร้อมปุ่มลองใหม่)
- **Supabase Auth**: โค้ด (@supabase/ssr, proxy.ts, callback) พร้อมแล้ว แต่ในสภาพแวดล้อมนี้ไม่มีโปรเจกต์ Supabase จึงใช้ Dev login; ต้องทดสอบ sign-up/sign-in จริงหลังตั้งค่า
- **Dev login** มีไว้สำหรับพัฒนาเท่านั้น ถูกปิดบน production โดยค่าเริ่มต้น
- ไม่มีระบบส่งอีเมล (คัดลอกลิงก์ส่งเอง), ไม่มี billing/ATS/payroll/video interview ตามขอบเขต MVP
- การเชิญสมาชิกต้องให้ผู้ใช้เข้าสู่ระบบก่อนหนึ่งครั้ง (ไม่มี pending invite)
- Retention purge เป็นปุ่มกดด้วยมือ ยังไม่มี cron อัตโนมัติ
- RLS policies เขียนสำหรับ Supabase client (authenticated) และยังไม่ได้ทดสอบผ่าน PostgREST จริง; การบังคับสิทธิ์หลักอยู่ที่ server code (มี tests)
- ยังไม่มี i18n (ภาษาไทยอย่างเดียว), ยังไม่มี dark mode

## ข้อจำกัดเชิงวิธีวิทยา (ต้องทำก่อนใช้ตัดสินใจจ้างจริง)
- ยังไม่ผ่าน psychometric validation: reliability, validity, fairness, job relevance
- สูตร alignment เป็น heuristic; ช่วงเป้าหมาย/น้ำหนักเป็น rubric เชิงทดลองที่ขึ้นกับคำตอบของผู้รับสมัคร
- เวลาโดยประมาณ 10–15 นาที เป็นค่าประมาณจนกว่าจะมีข้อมูลใช้งานจริง

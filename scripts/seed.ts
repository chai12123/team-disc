/**
 * Demo data (รันซ้ำได้): npm run db:seed  |  รีเซ็ต: npm run db:reset-demo
 * - องค์กร demo 2 แห่ง (แห่งที่สองใช้ทดสอบการแยกสิทธิ์)
 * - 3 ตำแหน่ง: Sales Consultant, Customer Success, Operations Coordinator (ผ่าน Role Discovery แบบ demo)
 * - ผู้สมัครสมมติ 8 คน: ต่ำกว่า/สูงกว่า/อยู่ในช่วงเป้าหมาย, ยังไม่ครบ, และคนละเวอร์ชันโปรไฟล์
 * ข้อมูล demo ติดธง organizations.is_demo = true แยกจากข้อมูลจริง
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
process.env.AI_PROVIDER = "demo"; // seed ใช้ demo adapter เสมอ ไม่เรียก API จริง

import { getSql } from "../src/lib/db/client";
import { runMigrations } from "../src/lib/db/migrate";
import { ensureAssessmentVersion, resetAssessmentCache } from "../src/lib/services/assessment";
import { createOrganizationForUser, findOrCreateDevUser } from "../src/lib/services/org";
import { confirmProfile, createRole, getLatestConfirmedVersion, getLatestProposedVersion, runDiscoveryTurn, saveProfileDraft } from "../src/lib/services/roles";
import { createInvitation } from "../src/lib/services/invitations";
import { saveAnswers, startSession, submitSession } from "../src/lib/services/candidateSessions";
import { ITEM_BANK, ITEM_ORDER } from "../src/lib/assessment/items";
import type { AxisKey } from "../src/lib/model/axes";
import type { OrgContext } from "../src/lib/auth/server";
import { DEMO_SCRIPT } from "../src/lib/ai/demo";

const reset = process.argv.includes("--reset");

export const DEMO_EMAILS = {
  admin: "admin@demo.teamfit.local",
  recruiter: "recruiter@demo.teamfit.local",
  otherAdmin: "other-admin@demo.teamfit.local",
};

/** สร้างคำตอบ 64 ข้อให้คะแนนแต่ละแกนใกล้ค่าที่ตั้งใจ (deterministic) */
export function answersForProfile(intended: Record<AxisKey, number>, seed = 1) {
  const answers: { itemId: string; value: number }[] = [];
  ITEM_BANK.forEach((it, idx) => {
    const target = 1 + (4 * intended[it.scale]) / 100; // mean ที่ต้องการ (1–5)
    const jitter = ((idx * 7 + seed * 3) % 3) - 1; // -1, 0, 1
    let scored = Math.round(target + jitter * 0.6);
    scored = Math.max(1, Math.min(5, scored));
    const value = it.reverseScored ? 6 - scored : scored;
    answers.push({ itemId: it.id, value });
  });
  return answers;
}

function ctxFor(orgId: string, userId: string, role: "org_admin" | "recruiter" = "org_admin"): OrgContext {
  return {
    user: { id: userId, email: null, displayName: null },
    org: { id: orgId, name: "", slug: "", dataRetentionDays: 365, isDemo: true },
    membership: { orgId, orgName: "", role, isDemo: true },
    memberships: [],
  };
}

/** คุยกับ demo adapter ตามสคริปต์จนได้ร่างโปรไฟล์ */
async function discover(ctx: OrgContext, roleId: string, answers: Record<string, string>) {
  let turn = await runDiscoveryTurn(ctx, roleId, null);
  let guard = 0;
  while (turn.phase !== "ready" && guard++ < 20) {
    const q = turn.aiMessage.options[0];
    const a = q ? (answers[q.id] ?? q.options[0]) : "ขอสรุป";
    turn = await runDiscoveryTurn(ctx, roleId, a);
  }
  const proposed = await getLatestProposedVersion(roleId);
  if (!proposed) throw new Error("ไม่ได้ร่างโปรไฟล์");
  return proposed;
}

async function seedCandidate(
  roleToken: string,
  name: string,
  intended: Record<AxisKey, number> | null,
  opts: { partial?: number; seed?: number } = {},
) {
  const started = await startSession(roleToken, { consent: true, displayName: name, email: "" }, { ip: "127.0.0.1", userAgent: "seed" });
  if (!intended) return started;
  const all = answersForProfile(intended, opts.seed ?? 1);
  const subset = opts.partial ? ITEM_ORDER.slice(0, opts.partial).map((id) => all.find((a) => a.itemId === id)!) : all;
  for (let i = 0; i < subset.length; i += 16) await saveAnswers(started.sessionToken, { answers: subset.slice(i, i + 16), currentPage: Math.floor(i / 8) });
  if (!opts.partial) {
    // ปรับ started_at ย้อนหลังเพื่อให้มีระยะเวลาสมเหตุผล
    const sql = getSql();
    await sql`update assessment_sessions set started_at = now() - interval '11 minutes' where id = ${started.sessionId}`;
    await submitSession(started.sessionToken);
  }
  return started;
}

const P = (d: number, di: number, i: number, is: number, s: number, sc: number, c: number, cd: number): Record<AxisKey, number> => ({ D: d, Di: di, I: i, iS: is, S: s, SC: sc, C: c, CD: cd });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("ไม่พบ DATABASE_URL");
  await runMigrations(url);
  const sql = getSql();

  if (reset) {
    await sql`delete from organizations where is_demo = true`;
    await sql`delete from users where email like '%@demo.teamfit.local'`;
    await sql`delete from rate_limits where key like 'ai:%'`;
    console.log("reset: ลบข้อมูล demo แล้ว");
  }
  const existing = await sql`select 1 from organizations where is_demo = true limit 1`;
  if (existing.length > 0) {
    console.log("มีข้อมูล demo อยู่แล้ว (ใช้ npm run db:reset-demo เพื่อสร้างใหม่)");
    await sql.end();
    return;
  }

  resetAssessmentCache();
  await ensureAssessmentVersion();

  const adminId = await findOrCreateDevUser(DEMO_EMAILS.admin, "คุณปราง (Admin)");
  const recruiterId = await findOrCreateDevUser(DEMO_EMAILS.recruiter, "คุณต้น (Recruiter)");
  const otherAdminId = await findOrCreateDevUser(DEMO_EMAILS.otherAdmin, "ผู้ดูแลองค์กร B");

  const orgId = await createOrganizationForUser(adminId, "บริษัท ทีมฟิต เดโม จำกัด");
  await sql`update organizations set is_demo = true where id = ${orgId}`;
  await sql`insert into memberships (org_id, user_id, role) values (${orgId}, ${recruiterId}, 'recruiter')`;
  const otherOrgId = await createOrganizationForUser(otherAdminId, "องค์กร B (ทดสอบแยกสิทธิ์)");
  await sql`update organizations set is_demo = true where id = ${otherOrgId}`;
  const ctx = ctxFor(orgId, adminId);

  // ---------- Sales Consultant ----------
  const sales = await createRole(ctx, { title: "Sales Consultant", level: "ระดับปฏิบัติการ" });
  const salesDraft = await discover(ctx, sales.id, {
    level_duties: "ระดับปฏิบัติการ\nนำเสนอโซลูชันให้ลูกค้าธุรกิจ ปิดการขายรายไตรมาส ดูแลลูกค้าหลังการขาย",
    outcome_90: "ตัวเลข/ยอดที่วัดได้ชัดเจน",
    frequent_situation: "ลูกค้า/ผู้ใช้ติดต่อเข้ามาตลอด ต้องตอบสนองทันที",
    decision_speed: "ภายในวันเดียว ปรึกษาได้บ้าง",
    cost_of_error: "เสียเงินหรือเสียลูกค้า แต่กู้คืนได้",
    routine_vs_initiative: "ริเริ่มเองเป็นหลัก (≥70%)",
    interaction_mix: "โน้มน้าวให้คนตัดสินใจ",
    routine_change_ratio: "งานเปลี่ยนตลอดเป็นส่วนใหญ่ (≥70%)",
    authority: "ตัดสินใจได้ในกรอบที่กำหนด",
    tradeoff_deadline: "ส่งก่อนพร้อมระบุข้อจำกัดชัดเจน",
    manager_team: "หัวหน้าให้อิสระ ดูที่ผลลัพธ์",
    skills_separate: "ความรู้ผลิตภัณฑ์ SaaS, การเจรจาต่อรอง, ภาษาอังกฤษสำหรับลูกค้าต่างชาติ",
  });
  await confirmProfile(ctx, sales.id, salesDraft.id);
  const salesInv = await createInvitation(ctx, sales.id, { kind: "shared", label: "ลิงก์กลาง JobsDB", expiresInDays: 90 });
  const salesPersonal = await createInvitation(ctx, sales.id, { kind: "personal", label: "ผู้สมัครที่แนะนำมา", expiresInDays: 30 });
  await seedCandidate(salesInv.token, "อรุณ (อยู่ในช่วง)", P(70, 75, 70, 55, 40, 45, 45, 50), { seed: 1 });
  await seedCandidate(salesInv.token, "เบญจ (ต่ำกว่าช่วง)", P(35, 30, 35, 70, 75, 70, 65, 40), { seed: 2 });
  await seedCandidate(salesInv.token, "ชลิต (สูงกว่าช่วง)", P(95, 95, 95, 30, 15, 20, 25, 85), { seed: 3 });
  await seedCandidate(salesPersonal.token, "ดวงใจ (ยังไม่ครบ)", P(60, 60, 60, 60, 50, 50, 50, 50), { partial: 40 });

  // ---------- Customer Success ----------
  const cs = await createRole(ctx, { title: "Customer Success Specialist", level: "ระดับปฏิบัติการ" });
  const csDraft = await discover(ctx, cs.id, {
    level_duties: "ระดับปฏิบัติการ\nดูแลลูกค้าเดิม ติดตามการใช้งาน แก้ปัญหา และประสานทีมภายใน",
    outcome_90: "ความสัมพันธ์กับลูกค้า/ทีมแน่นแฟ้น",
    frequent_situation: "ลูกค้า/ผู้ใช้ติดต่อเข้ามาตลอด ต้องตอบสนองทันที",
    decision_speed: "ภายในวันเดียว ปรึกษาได้บ้าง",
    cost_of_error: "เสียเงินหรือเสียลูกค้า แต่กู้คืนได้",
    routine_vs_initiative: "ผสมกันพอ ๆ กัน",
    interaction_mix: "ดูแลลูกค้าเดิมอย่างต่อเนื่อง",
    routine_change_ratio: "ครึ่งต่อครึ่ง",
    authority: "ตัดสินใจได้ในกรอบที่กำหนด",
    tradeoff_deadline: "ส่งเฉพาะส่วนที่ยืนยันแล้ว ส่วนที่เหลือตามมา",
    manager_team: "ทีมกระจาย/ทำงานทางไกล สื่อสารผ่านข้อความเป็นหลัก",
    skills_separate: "การใช้ระบบ CRM, การเขียนอีเมลภาษาไทยและอังกฤษ",
  });
  await confirmProfile(ctx, cs.id, csDraft.id);
  const csInv = await createInvitation(ctx, cs.id, { kind: "shared", label: "ลิงก์กลาง", expiresInDays: 90 });
  await seedCandidate(csInv.token, "เอก (อยู่ในช่วง)", P(45, 45, 65, 75, 65, 60, 50, 40), { seed: 4 });
  await seedCandidate(csInv.token, "ฝน (ผสม)", P(80, 70, 85, 40, 30, 35, 40, 70), { seed: 5 });

  // ---------- Operations Coordinator: มี 2 เวอร์ชันโปรไฟล์ ----------
  const ops = await createRole(ctx, { title: "Operations Coordinator", level: "ระดับอาวุโส" });
  const opsDraft = await discover(ctx, ops.id, {
    level_duties: "ระดับอาวุโส/หัวหน้าทีม\nประสานงานซัพพลายเออร์ ตรวจเอกสารนำเข้า และติดตามสถานะงานประจำวัน",
    outcome_90: "ระบบงานนิ่ง ไม่มีข้อผิดพลาดสำคัญ",
    frequent_situation: "เอกสารหรือข้อมูลจำนวนมากที่ต้องตรวจให้ถูกต้อง",
    decision_speed: "ภายในไม่กี่นาที แทบไม่มีเวลาปรึกษา",
    cost_of_error: "เสียหายรุนแรง กู้คืนยาก หรือผิดกฎระเบียบ",
    routine_vs_initiative: "ผสมกันพอ ๆ กัน",
    conflict_speed_vs_error: "ไม่มี — ยอมช้าลงเล็กน้อยดีกว่า",
    interaction_mix: "ตรวจและวิเคราะห์ข้อมูล",
    routine_change_ratio: "งานประจำเป็นส่วนใหญ่ (≥70%)",
    authority: "ต้องขออนุมัติเกือบทุกเรื่อง",
    tradeoff_deadline: "ขอเลื่อนจนกว่าข้อมูลครบ เพราะความถูกต้องสำคัญกว่า",
    manager_team: "หัวหน้าลงรายละเอียด ติดตามใกล้ชิด",
    skills_separate: "Excel ขั้นสูง, ความรู้พิธีการศุลกากร",
  });
  await confirmProfile(ctx, ops.id, opsDraft.id);
  const opsInvV1 = await createInvitation(ctx, ops.id, { kind: "shared", label: "รอบแรก (โปรไฟล์ v1)", expiresInDays: 90 });
  await seedCandidate(opsInvV1.token, "กิตติ (โปรไฟล์ v1)", P(40, 35, 40, 55, 75, 80, 80, 55), { seed: 6 });
  // ปรับโปรไฟล์เป็น v2 (องค์กรลดความเข้มของ C และเพิ่มน้ำหนัก SC) แล้วยืนยัน
  const v1 = (await getLatestConfirmedVersion(ops.id))!;
  const v2profile = structuredClone(v1.profile);
  v2profile.axes.C.targetMin = 55;
  v2profile.axes.SC.weight = 2.5;
  v2profile.assumptions.push("v2: ปรับหลังคุยกับหัวหน้างานว่ามีผู้ช่วยตรวจทานเอกสาร");
  const draft2 = await saveProfileDraft(ctx, ops.id, v2profile);
  await confirmProfile(ctx, ops.id, draft2.id);
  const opsInvV2 = await createInvitation(ctx, ops.id, { kind: "shared", label: "รอบสอง (โปรไฟล์ v2)", expiresInDays: 90 });
  await seedCandidate(opsInvV2.token, "ขวัญ (โปรไฟล์ v2)", P(45, 40, 45, 60, 70, 85, 70, 60), { seed: 7 });
  // ลิงก์ที่หมดอายุและเพิกถอน (สำหรับทดสอบสถานะ)
  const expired = await createInvitation(ctx, ops.id, { kind: "personal", label: "ลิงก์หมดอายุ (ตัวอย่าง)", expiresInDays: 1 });
  await sql`update invitations set expires_at = now() - interval '1 day' where id = ${expired.id}`;
  const revoked = await createInvitation(ctx, ops.id, { kind: "personal", label: "ลิงก์เพิกถอน (ตัวอย่าง)", expiresInDays: 30 });
  await sql`update invitations set revoked_at = now() where id = ${revoked.id}`;

  // ---------- องค์กร B: ตำแหน่งหนึ่งเพื่อทดสอบว่าองค์กร A มองไม่เห็น ----------
  const ctxB = ctxFor(otherOrgId, otherAdminId);
  const roleB = await createRole(ctxB, { title: "Accountant (องค์กร B)", level: "" });
  const bDraft = await discover(ctxB, roleB.id, { frequent_situation: "เอกสารหรือข้อมูลจำนวนมากที่ต้องตรวจให้ถูกต้อง" });
  await confirmProfile(ctxB, roleB.id, bDraft.id);
  const bInv = await createInvitation(ctxB, roleB.id, { kind: "shared", label: "", expiresInDays: 90 });
  await seedCandidate(bInv.token, "ผู้สมัครองค์กร B", P(40, 40, 40, 50, 60, 70, 80, 60), { seed: 8 });

  console.log("seed: เสร็จแล้ว");
  console.log(`  dev login: ${DEMO_EMAILS.admin} (admin), ${DEMO_EMAILS.recruiter} (recruiter), ${DEMO_EMAILS.otherAdmin} (องค์กร B)`);
  console.log(`  ลิงก์กลาง Sales Consultant (ทดสอบฝั่งผู้สมัคร): /a/${salesInv.token}`);
  console.log(`  จำนวน script คำถาม demo: ${DEMO_SCRIPT.length}`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

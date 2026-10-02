import { createHash } from "node:crypto";
import { z } from "zod";
import { getSql } from "@/lib/db/client";
import { ITEM_BANK, ITEM_ORDER, ITEMS_PER_PAGE, publicItems, type PublicItem } from "@/lib/assessment/items";
import { AXES } from "@/lib/model/axes";
import { toAxisTargets, RoleProfileSchema } from "@/lib/model/roleProfile";
import { ASSESSMENT_VERSION_CODE, CONSENT_VERSION, SCORING_VERSION } from "@/lib/model/versions";
import { computeAlignment, computeResponseQuality, computeScaleScores, ScoringError, type AlignmentResult } from "@/lib/scoring";
import { ApiError } from "@/lib/util/http";
import { audit } from "@/lib/util/audit";
import { generateCandidateCode, generateToken, hashToken, looksLikeToken } from "@/lib/util/tokens";
import { env } from "@/lib/env";

/* ---------- ลิงก์เชิญ (start token) ---------- */

export interface InviteContext {
  invitationId: string;
  orgId: string;
  orgName: string;
  roleId: string;
  roleTitle: string;
  kind: "shared" | "personal";
  profileVersionId: string;
  assessmentVersionId: string;
  status: "active" | "revoked" | "expired" | "used";
  dataRetentionDays: number;
}

export async function resolveInviteToken(token: string): Promise<InviteContext> {
  if (!looksLikeToken(token)) throw new ApiError(404, "ไม่พบลิงก์นี้", "not_found");
  const sql = getSql();
  const rows = await sql<
    (Omit<InviteContext, "status"> & { revokedAt: string | null; expiresAt: string | null; sessionCount: number })[]
  >`
    select i.id as invitation_id, i.org_id, o.name as org_name, i.role_id, r.title as role_title, i.kind,
      i.role_profile_version_id as profile_version_id, i.assessment_version_id, i.revoked_at, i.expires_at,
      o.data_retention_days,
      (select count(*)::int from assessment_sessions s where s.invitation_id = i.id) as session_count
    from invitations i
    join organizations o on o.id = i.org_id
    join roles r on r.id = i.role_id
    where i.token_hash = ${hashToken(token)}
  `;
  const inv = rows[0];
  if (!inv) throw new ApiError(404, "ไม่พบลิงก์นี้", "not_found");
  let status: InviteContext["status"] = "active";
  if (inv.revokedAt) status = "revoked";
  else if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) status = "expired";
  else if (inv.kind === "personal" && inv.sessionCount > 0) status = "used";
  return {
    invitationId: inv.invitationId,
    orgId: inv.orgId,
    orgName: inv.orgName,
    roleId: inv.roleId,
    roleTitle: inv.roleTitle,
    kind: inv.kind,
    profileVersionId: inv.profileVersionId,
    assessmentVersionId: inv.assessmentVersionId,
    status,
    dataRetentionDays: inv.dataRetentionDays,
  };
}

export const StartSessionSchema = z.object({
  consent: z.literal(true, { message: "ต้องยินยอมก่อนเริ่ม" }),
  displayName: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().email().max(200).optional().or(z.literal("")).default(""),
});

/** เริ่ม session ใหม่จากลิงก์เชิญ → คืน session token (คนละตัวกับ invite token) */
export async function startSession(
  token: string,
  input: z.infer<typeof StartSessionSchema>,
  meta: { ip: string; userAgent: string | null },
) {
  const inv = await resolveInviteToken(token);
  if (inv.status === "revoked") throw new ApiError(410, "ลิงก์นี้ถูกเพิกถอนแล้ว", "revoked");
  if (inv.status === "expired") throw new ApiError(410, "ลิงก์นี้หมดอายุแล้ว", "expired");
  if (inv.status === "used") throw new ApiError(409, "ลิงก์นี้ถูกใช้เริ่มทำแบบประเมินแล้ว กรุณาใช้ลิงก์สำหรับกลับมาทำต่อ", "used");

  const sql = getSql();
  const sessionToken = generateToken();
  const ipHash = createHash("sha256").update(`${env.appSecret}:${meta.ip}`).digest("hex").slice(0, 32);

  const result = await sql.begin(async (tx) => {
    // ป้องกัน race ของลิงก์เฉพาะบุคคล
    if (inv.kind === "personal") {
      const existing = await tx`select 1 from assessment_sessions where invitation_id = ${inv.invitationId} for update`;
      if (existing.length > 0) throw new ApiError(409, "ลิงก์นี้ถูกใช้แล้ว", "used");
    }
    let code = generateCandidateCode();
    for (let i = 0; i < 5; i++) {
      const dup = await tx`select 1 from candidates where role_id = ${inv.roleId} and candidate_code = ${code}`;
      if (dup.length === 0) break;
      code = generateCandidateCode();
    }
    const cand = await tx<{ id: string }[]>`
      insert into candidates (org_id, role_id, candidate_code, display_name, email)
      values (${inv.orgId}, ${inv.roleId}, ${code}, ${input.displayName || null}, ${input.email || null})
      returning id
    `;
    const consent = await tx<{ id: string }[]>`
      insert into consent_records (org_id, consent_version, user_agent, ip_hash)
      values (${inv.orgId}, ${CONSENT_VERSION}, ${meta.userAgent?.slice(0, 300) ?? null}, ${ipHash})
      returning id
    `;
    const sess = await tx<{ id: string }[]>`
      insert into assessment_sessions (org_id, role_id, invitation_id, candidate_id, role_profile_version_id, assessment_version_id,
        session_token_hash, status, consent_record_id, started_at, last_saved_at)
      values (${inv.orgId}, ${inv.roleId}, ${inv.invitationId}, ${cand[0].id}, ${inv.profileVersionId}, ${inv.assessmentVersionId},
        ${hashToken(sessionToken)}, 'in_progress', ${consent[0].id}, now(), now())
      returning id
    `;
    return { sessionId: sess[0].id, candidateCode: code };
  });

  await audit({ orgId: inv.orgId, actorType: "candidate", actorId: result.candidateCode, action: "session.start", entityType: "assessment_session", entityId: result.sessionId, meta: { kind: inv.kind } });
  return { sessionToken, sessionId: result.sessionId, candidateCode: result.candidateCode, path: `/s/${sessionToken}` };
}

/* ---------- session (resume token) ---------- */

export interface SessionState {
  sessionId: string;
  orgName: string;
  roleTitle: string;
  candidateCode: string;
  status: "not_started" | "in_progress" | "completed";
  currentPage: number;
  itemsPerPage: number;
  items: PublicItem[];
  answers: Record<string, number>;
  startedAt: string | null;
  submittedAt: string | null;
  lastSavedAt: string | null;
}

interface SessionRow {
  id: string;
  orgId: string;
  roleId: string;
  candidateId: string;
  candidateCode: string;
  orgName: string;
  roleTitle: string;
  status: SessionState["status"];
  currentPage: number;
  startedAt: string | null;
  submittedAt: string | null;
  lastSavedAt: string | null;
  roleProfileVersionId: string;
}

async function loadSessionByToken(token: string): Promise<SessionRow> {
  if (!looksLikeToken(token)) throw new ApiError(404, "ไม่พบแบบประเมินนี้", "not_found");
  const sql = getSql();
  const rows = await sql<SessionRow[]>`
    select s.id, s.org_id, s.role_id, s.candidate_id, c.candidate_code, o.name as org_name, r.title as role_title,
      s.status, s.current_page, s.started_at, s.submitted_at, s.last_saved_at, s.role_profile_version_id
    from assessment_sessions s
    join candidates c on c.id = s.candidate_id
    join organizations o on o.id = s.org_id
    join roles r on r.id = s.role_id
    where s.session_token_hash = ${hashToken(token)}
  `;
  if (!rows[0]) throw new ApiError(404, "ไม่พบแบบประเมินนี้", "not_found");
  return rows[0];
}

export async function getSessionState(token: string): Promise<SessionState> {
  const s = await loadSessionByToken(token);
  const sql = getSql();
  const resp = await sql<{ itemId: string; value: number }[]>`select item_id, value from responses where session_id = ${s.id}`;
  return {
    sessionId: s.id,
    orgName: s.orgName,
    roleTitle: s.roleTitle,
    candidateCode: s.candidateCode,
    status: s.status,
    currentPage: s.currentPage,
    itemsPerPage: ITEMS_PER_PAGE,
    items: publicItems(),
    answers: Object.fromEntries(resp.map((r) => [r.itemId, r.value])),
    startedAt: s.startedAt,
    submittedAt: s.submittedAt,
    lastSavedAt: s.lastSavedAt,
  };
}

export const SaveAnswersSchema = z.object({
  answers: z
    .array(z.object({ itemId: z.string().max(10), value: z.number().int().min(1).max(5) }))
    .min(1)
    .max(64),
  currentPage: z.number().int().min(0).max(20).optional(),
});

/** autosave: upsert คำตอบ (ไม่รับหลัง submit) */
export async function saveAnswers(token: string, input: z.infer<typeof SaveAnswersSchema>) {
  const s = await loadSessionByToken(token);
  if (s.status === "completed") throw new ApiError(409, "ส่งแบบประเมินแล้ว แก้ไขคำตอบไม่ได้", "already_submitted");
  const valid = new Set(ITEM_ORDER);
  for (const a of input.answers) if (!valid.has(a.itemId)) throw new ApiError(400, `ไม่รู้จักข้อ ${a.itemId}`, "unknown_item");
  const sql = getSql();
  await sql.begin(async (tx) => {
    for (const a of input.answers) {
      await tx`
        insert into responses (session_id, item_id, value) values (${s.id}, ${a.itemId}, ${a.value})
        on conflict (session_id, item_id) do update set value = excluded.value, updated_at = now()
      `;
    }
    await tx`
      update assessment_sessions set last_saved_at = now(), status = 'in_progress',
        current_page = ${input.currentPage ?? s.currentPage}
      where id = ${s.id}
    `;
  });
  const count = await sql<{ n: number }[]>`select count(*)::int as n from responses where session_id = ${s.id}`;
  return { savedAt: new Date().toISOString(), answeredCount: count[0].n, totalCount: ITEM_BANK.length };
}

/** ส่งแบบประเมิน: ตรวจครบ 64 ข้อ → คำนวณคะแนนด้วยโค้ด → บันทึก score_report (ป้องกัน submit ซ้ำ) */
export async function submitSession(token: string) {
  const s = await loadSessionByToken(token);
  const sql = getSql();
  if (s.status === "completed") {
    return { sessionId: s.id, alreadySubmitted: true };
  }
  const resp = await sql<{ itemId: string; value: number; answeredAt: string }[]>`
    select item_id, value, answered_at from responses where session_id = ${s.id}
  `;
  let scale;
  try {
    scale = computeScaleScores(ITEM_BANK, resp);
  } catch (e) {
    if (e instanceof ScoringError && e.code === "INCOMPLETE") {
      throw new ApiError(400, e.message, "incomplete", e.details);
    }
    throw e;
  }
  const versionRows = await sql<{ profile: unknown }[]>`select profile from role_profile_versions where id = ${s.roleProfileVersionId}`;
  const profile = RoleProfileSchema.parse(versionRows[0]?.profile);
  const alignment: AlignmentResult = computeAlignment(scale.scores, toAxisTargets(profile));
  const submittedAt = new Date();
  const quality = computeResponseQuality(ITEM_BANK, ITEM_ORDER, resp, { startedAt: s.startedAt, submittedAt });

  await sql.begin(async (tx) => {
    // lock แถว session เพื่อกัน submit ซ้ำพร้อมกัน
    const locked = await tx<{ status: string }[]>`select status from assessment_sessions where id = ${s.id} for update`;
    if (locked[0]?.status === "completed") return;
    await tx`update assessment_sessions set status = 'completed', submitted_at = ${submittedAt} where id = ${s.id}`;
    await tx`
      insert into score_reports (session_id, scoring_version, assessment_version_code, role_profile_version_id, scale_scores, alignment, response_quality)
      values (${s.id}, ${SCORING_VERSION}, ${ASSESSMENT_VERSION_CODE}, ${s.roleProfileVersionId},
              ${tx.json(scale.scores as never)}, ${tx.json(alignment as never)}, ${tx.json(quality as never)})
      on conflict (session_id) do nothing
    `;
  });
  await audit({ orgId: s.orgId, actorType: "candidate", actorId: s.candidateCode, action: "session.submit", entityType: "assessment_session", entityId: s.id, meta: { scoringVersion: SCORING_VERSION } });
  return { sessionId: s.id, alreadySubmitted: false };
}

/** ข้อมูลสำหรับหน้ารายงานของผู้สมัคร (เห็นเฉพาะของตนเอง ไม่เห็นเป้าหมาย/ดัชนี) */
export async function getCandidateReportData(token: string) {
  const s = await loadSessionByToken(token);
  if (s.status !== "completed") throw new ApiError(409, "ยังไม่ได้ส่งแบบประเมิน", "not_completed");
  const sql = getSql();
  const sr = await sql<{ id: string; scaleScores: Record<string, number>; responseQuality: unknown; scoringVersion: string; assessmentVersionCode: string; computedAt: string }[]>`
    select id, scale_scores, response_quality, scoring_version, assessment_version_code, computed_at from score_reports where session_id = ${s.id}
  `;
  if (!sr[0]) throw new ApiError(409, "ยังไม่มีผลคะแนน", "no_score");
  const ai = await sql<{ provider: string; model: string; content: unknown; createdAt: string }[]>`
    select provider, model, content, created_at from ai_reports where session_id = ${s.id} and audience = 'candidate'
  `;
  return {
    sessionId: s.id,
    candidateCode: s.candidateCode,
    orgName: s.orgName,
    roleTitle: s.roleTitle,
    submittedAt: s.submittedAt,
    scaleScores: Object.fromEntries(AXES.map((k) => [k, sr[0].scaleScores[k]])) as Record<(typeof AXES)[number], number>,
    responseQuality: sr[0].responseQuality,
    scoringVersion: sr[0].scoringVersion,
    assessmentVersionCode: sr[0].assessmentVersionCode,
    aiReport: ai[0] ?? null,
  };
}

export async function requestDeletion(token: string, reason: string) {
  const s = await loadSessionByToken(token);
  const sql = getSql();
  await sql`
    insert into deletion_requests (org_id, session_id, requested_by, reason)
    values (${s.orgId}, ${s.id}, 'candidate', ${reason.slice(0, 500)})
  `;
  await audit({ orgId: s.orgId, actorType: "candidate", actorId: s.candidateCode, action: "deletion.request", entityType: "assessment_session", entityId: s.id });
}

export { loadSessionByToken };

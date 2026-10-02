import { getSql } from "@/lib/db/client";
import { getAIAdapter, AIError, type ReportInput } from "@/lib/ai";
import { AXES, AXIS_DEFINITIONS, type AxisKey } from "@/lib/model/axes";
import { RoleProfileSchema, type RoleProfile } from "@/lib/model/roleProfile";
import type { AlignmentResult, ResponseQuality, ScaleScores } from "@/lib/scoring";
import { ApiError } from "@/lib/util/http";
import { audit } from "@/lib/util/audit";
import { rateLimit } from "@/lib/util/ratelimit";
import type { OrgContext } from "@/lib/auth/server";

export interface ScoreReportRow {
  id: string;
  sessionId: string;
  scoringVersion: string;
  assessmentVersionCode: string;
  roleProfileVersionId: string;
  scaleScores: ScaleScores;
  alignment: AlignmentResult;
  responseQuality: ResponseQuality;
  computedAt: string;
}

export interface SessionDetail {
  id: string;
  orgId: string;
  roleId: string;
  roleTitle: string;
  candidateId: string;
  candidateCode: string;
  displayName: string | null;
  email: string | null;
  status: "not_started" | "in_progress" | "completed";
  startedAt: string | null;
  submittedAt: string | null;
  lastSavedAt: string | null;
  answeredCount: number;
  profileVersionId: string;
  profileVersion: number;
  profile: RoleProfile;
  assessmentCode: string;
  invitationKind: "shared" | "personal";
}

export interface AiReportRow {
  id: string;
  audience: "candidate" | "organization";
  provider: string;
  model: string;
  status: string;
  content: unknown;
  createdAt: string;
}

/** รายละเอียด session สำหรับองค์กร (ตรวจ org เสมอ) */
export async function getSessionForOrg(orgId: string, sessionId: string): Promise<SessionDetail> {
  if (!/^[0-9a-f-]{36}$/.test(sessionId)) throw new ApiError(404, "ไม่พบข้อมูล", "not_found");
  const sql = getSql();
  const rows = await sql<SessionDetail[]>`
    select s.id, s.org_id, s.role_id, r.title as role_title, s.candidate_id, c.candidate_code, c.display_name, c.email,
      s.status, s.started_at, s.submitted_at, s.last_saved_at,
      (select count(*)::int from responses x where x.session_id = s.id) as answered_count,
      v.id as profile_version_id, v.version as profile_version, v.profile, av.code as assessment_code, i.kind as invitation_kind
    from assessment_sessions s
    join roles r on r.id = s.role_id
    join candidates c on c.id = s.candidate_id
    join role_profile_versions v on v.id = s.role_profile_version_id
    join assessment_versions av on av.id = s.assessment_version_id
    join invitations i on i.id = s.invitation_id
    where s.id = ${sessionId} and s.org_id = ${orgId}
  `;
  if (!rows[0]) throw new ApiError(404, "ไม่พบข้อมูล", "not_found");
  rows[0].profile = RoleProfileSchema.parse(rows[0].profile);
  return rows[0];
}

export async function getScoreReport(sessionId: string): Promise<ScoreReportRow | null> {
  const sql = getSql();
  const rows = await sql<ScoreReportRow[]>`
    select id, session_id, scoring_version, assessment_version_code, role_profile_version_id, scale_scores, alignment, response_quality, computed_at
    from score_reports where session_id = ${sessionId}
  `;
  return rows[0] ?? null;
}

export async function getAiReport(sessionId: string, audience: "candidate" | "organization"): Promise<AiReportRow | null> {
  const sql = getSql();
  const rows = await sql<AiReportRow[]>`
    select id, audience, provider, model, status, content, created_at from ai_reports where session_id = ${sessionId} and audience = ${audience}
  `;
  return rows[0] ?? null;
}

function axisNames(): Record<AxisKey, string> {
  return Object.fromEntries(AXES.map((k) => [k, AXIS_DEFINITIONS[k].nameTh])) as Record<AxisKey, string>;
}

/**
 * สร้างคำอธิบายด้วย AI (หรือคืนของเดิม) — AI ได้รับเฉพาะคะแนนที่คำนวณแล้วและรหัสผู้สมัคร ไม่ได้รับชื่อ/อีเมล
 * ผลลัพธ์ผ่าน schema validation ก่อนบันทึก; คะแนนใน score_reports ไม่ถูกแตะต้อง
 */
export async function ensureAiReport(
  sessionId: string,
  audience: "candidate" | "organization",
  opts: { force?: boolean; rateKey: string } ,
): Promise<AiReportRow> {
  const existing = await getAiReport(sessionId, audience);
  if (existing && !opts.force) return existing;
  await rateLimit(`ai:report:${opts.rateKey}`, 30, 600);

  const sql = getSql();
  const base = await sql<{ orgId: string; candidateCode: string; roleTitle: string; profile: unknown }[]>`
    select s.org_id, c.candidate_code, r.title as role_title, v.profile
    from assessment_sessions s join candidates c on c.id = s.candidate_id join roles r on r.id = s.role_id
    join role_profile_versions v on v.id = s.role_profile_version_id
    where s.id = ${sessionId}
  `;
  if (!base[0]) throw new ApiError(404, "ไม่พบข้อมูล", "not_found");
  const score = await getScoreReport(sessionId);
  if (!score) throw new ApiError(409, "ยังไม่มีผลคะแนน (ยังไม่สมบูรณ์)", "no_score");

  const input: ReportInput = {
    roleTitle: base[0].roleTitle,
    candidateCode: base[0].candidateCode,
    profile: RoleProfileSchema.parse(base[0].profile),
    scaleScores: score.scaleScores,
    alignment: audience === "organization" ? score.alignment : null,
    responseQuality: score.responseQuality,
    axisNames: axisNames(),
  };
  const adapter = getAIAdapter();
  let result;
  try {
    result = audience === "candidate" ? await adapter.candidateReport(input) : await adapter.organizationReport(input);
  } catch (e) {
    const code = e instanceof AIError ? e.code : "api";
    await audit({ orgId: base[0].orgId, actorType: "system", action: "ai.report.failed", entityType: "assessment_session", entityId: sessionId, meta: { audience, code, provider: adapter.provider } });
    throw new ApiError(502, e instanceof AIError ? e.message : "สร้างคำอธิบายไม่สำเร็จ", `ai_${code}`);
  }
  const rows = await sql<AiReportRow[]>`
    insert into ai_reports (session_id, audience, provider, model, status, content, score_report_id)
    values (${sessionId}, ${audience}, ${result.provider}, ${result.model}, 'ready', ${sql.json(result.content as never)}, ${score.id})
    on conflict (session_id, audience) do update set provider = excluded.provider, model = excluded.model,
      status = 'ready', content = excluded.content, score_report_id = excluded.score_report_id, created_at = now()
    returning id, audience, provider, model, status, content, created_at
  `;
  await audit({ orgId: base[0].orgId, actorType: "system", action: "ai.report.generate", entityType: "assessment_session", entityId: sessionId, meta: { audience, provider: result.provider } });
  return rows[0];
}

/* ---------- notes ---------- */
export interface NoteRow {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: string;
}

export async function listNotes(orgId: string, sessionId: string): Promise<NoteRow[]> {
  const sql = getSql();
  return sql<NoteRow[]>`
    select n.id, n.body, coalesce(u.display_name, u.email) as author_name, n.created_at
    from recruiter_notes n left join users u on u.id = n.author_user_id
    where n.org_id = ${orgId} and n.session_id = ${sessionId} order by n.created_at desc
  `;
}

export async function addNote(ctx: OrgContext, sessionId: string, body: string) {
  await getSessionForOrg(ctx.org.id, sessionId);
  const sql = getSql();
  await sql`insert into recruiter_notes (org_id, session_id, author_user_id, body) values (${ctx.org.id}, ${sessionId}, ${ctx.user.id}, ${body.slice(0, 4000)})`;
}

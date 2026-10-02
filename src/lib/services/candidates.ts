import { getSql } from "@/lib/db/client";
import { AXES } from "@/lib/model/axes";
import type { AlignmentResult, ScaleScores } from "@/lib/scoring";
import { ApiError } from "@/lib/util/http";
import { audit } from "@/lib/util/audit";
import type { OrgContext } from "@/lib/auth/server";
import { getRole } from "./roles";

export interface CandidateListRow {
  sessionId: string;
  candidateCode: string;
  displayName: string | null;
  status: "not_started" | "in_progress" | "completed";
  startedAt: string | null;
  submittedAt: string | null;
  answeredCount: number;
  profileVersion: number;
  profileVersionId: string;
  assessmentCode: string;
  overall: number | null;
  scaleScores: ScaleScores | null;
  alignment: AlignmentResult | null;
  invitationKind: "shared" | "personal";
}

/** รายชื่อผู้สมัครของตำแหน่ง เรียงตามเวลาสมัคร (ไม่จัดอันดับอัตโนมัติ) */
export async function listCandidates(orgId: string, roleId: string): Promise<CandidateListRow[]> {
  await getRole(orgId, roleId);
  const sql = getSql();
  const rows = await sql<(Omit<CandidateListRow, "overall"> & { alignment: AlignmentResult | null })[]>`
    select s.id as session_id, c.candidate_code, c.display_name, s.status, s.started_at, s.submitted_at,
      (select count(*)::int from responses x where x.session_id = s.id) as answered_count,
      v.version as profile_version, v.id as profile_version_id, av.code as assessment_code,
      sr.scale_scores, sr.alignment, i.kind as invitation_kind
    from assessment_sessions s
    join candidates c on c.id = s.candidate_id
    join role_profile_versions v on v.id = s.role_profile_version_id
    join assessment_versions av on av.id = s.assessment_version_id
    join invitations i on i.id = s.invitation_id
    left join score_reports sr on sr.session_id = s.id
    where s.org_id = ${orgId} and s.role_id = ${roleId}
    order by s.created_at asc
  `;
  return rows.map((r) => ({ ...r, overall: r.alignment ? r.alignment.overall : null }));
}

export interface ComparisonResult {
  roleId: string;
  comparable: CandidateListRow[];
  excluded: { row: CandidateListRow; reason: string }[];
  referenceProfileVersion: number | null;
  referenceAssessmentCode: string | null;
  targets: { axis: (typeof AXES)[number]; targetMin: number; targetMax: number; weight: number }[] | null;
}

/**
 * เปรียบเทียบเฉพาะผู้สมัครที่ใช้ assessmentVersion และ roleProfileVersion เดียวกัน
 * ใช้เวอร์ชันของผู้สมัครคนแรกที่สมบูรณ์เป็นอ้างอิง; คนที่ต่างเวอร์ชันหรือไม่สมบูรณ์จะถูกแยกพร้อมเหตุผล
 */
export async function compareCandidates(orgId: string, roleId: string, sessionIds: string[]): Promise<ComparisonResult> {
  if (sessionIds.length < 2 || sessionIds.length > 4) throw new ApiError(400, "เลือกผู้สมัคร 2–4 คน", "bad_request");
  const all = await listCandidates(orgId, roleId);
  const chosen = sessionIds.map((id) => all.find((r) => r.sessionId === id)).filter((r): r is CandidateListRow => Boolean(r));
  if (chosen.length !== sessionIds.length) throw new ApiError(404, "ไม่พบผู้สมัครบางราย", "not_found");

  const completed = chosen.filter((r) => r.status === "completed" && r.alignment);
  const ref = completed[0] ?? null;
  const comparable: CandidateListRow[] = [];
  const excluded: ComparisonResult["excluded"] = [];
  for (const r of chosen) {
    if (r.status !== "completed" || !r.alignment) {
      excluded.push({ row: r, reason: `ยังไม่สมบูรณ์ (ตอบแล้ว ${r.answeredCount}/64 ข้อ)` });
    } else if (ref && (r.profileVersionId !== ref.profileVersionId || r.assessmentCode !== ref.assessmentCode)) {
      excluded.push({
        row: r,
        reason: `ใช้คนละเวอร์ชัน (โปรไฟล์ v${r.profileVersion} / ${r.assessmentCode}) จึงไม่รวมในตารางเดียวกัน`,
      });
    } else comparable.push(r);
  }
  const targets = ref
    ? AXES.map((axis) => {
        const a = ref.alignment!.axes.find((x) => x.axis === axis)!;
        return { axis, targetMin: a.targetMin, targetMax: a.targetMax, weight: a.weight };
      })
    : null;
  return {
    roleId,
    comparable,
    excluded,
    referenceProfileVersion: ref?.profileVersion ?? null,
    referenceAssessmentCode: ref?.assessmentCode ?? null,
    targets,
  };
}

/* ---------- การลบข้อมูล / retention ---------- */

export interface DeletionRequestRow {
  id: string;
  sessionId: string | null;
  candidateCode: string | null;
  roleTitle: string | null;
  requestedBy: string;
  reason: string;
  status: string;
  createdAt: string;
}

export async function listDeletionRequests(orgId: string): Promise<DeletionRequestRow[]> {
  const sql = getSql();
  return sql<DeletionRequestRow[]>`
    select d.id, d.session_id, c.candidate_code, r.title as role_title, d.requested_by, d.reason, d.status, d.created_at
    from deletion_requests d
    left join assessment_sessions s on s.id = d.session_id
    left join candidates c on c.id = s.candidate_id
    left join roles r on r.id = s.role_id
    where d.org_id = ${orgId} order by d.created_at desc
  `;
}

/** ลบข้อมูลผู้สมัครทั้งชุด (candidate → sessions → responses/reports cascade) */
export async function deleteCandidateData(ctx: OrgContext, sessionId: string, requestId?: string) {
  const sql = getSql();
  const rows = await sql<{ candidateId: string; candidateCode: string }[]>`
    select candidate_id, c.candidate_code from assessment_sessions s join candidates c on c.id = s.candidate_id
    where s.id = ${sessionId} and s.org_id = ${ctx.org.id}
  `;
  if (!rows[0]) throw new ApiError(404, "ไม่พบข้อมูล", "not_found");
  await sql.begin(async (tx) => {
    await tx`delete from candidates where id = ${rows[0].candidateId} and org_id = ${ctx.org.id}`;
    if (requestId) await tx`update deletion_requests set status = 'done', processed_at = now() where id = ${requestId} and org_id = ${ctx.org.id}`;
    else await tx`update deletion_requests set status = 'done', processed_at = now() where session_id = ${sessionId} and org_id = ${ctx.org.id}`;
  });
  await audit({ orgId: ctx.org.id, actorType: "user", actorId: ctx.user.id, action: "candidate.delete", entityType: "candidate", entityId: rows[0].candidateCode });
}

/** ลบข้อมูลที่เกินระยะเวลาเก็บขององค์กร */
export async function purgeExpiredData(ctx: OrgContext): Promise<number> {
  const sql = getSql();
  const rows = await sql<{ id: string }[]>`
    delete from candidates c using organizations o
    where c.org_id = o.id and o.id = ${ctx.org.id}
      and c.created_at < now() - make_interval(days => o.data_retention_days)
    returning c.id
  `;
  await audit({ orgId: ctx.org.id, actorType: "user", actorId: ctx.user.id, action: "retention.purge", entityType: "organization", entityId: ctx.org.id, meta: { deleted: rows.length } });
  return rows.length;
}

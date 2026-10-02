import { z } from "zod";
import { getSql } from "@/lib/db/client";
import type { OrgContext } from "@/lib/auth/server";
import { ApiError } from "@/lib/util/http";
import { audit } from "@/lib/util/audit";
import { generateToken, hashToken } from "@/lib/util/tokens";
import { ensureAssessmentVersion } from "./assessment";
import { getLatestConfirmedVersion, getRole } from "./roles";

export interface InvitationRow {
  id: string;
  roleId: string;
  kind: "shared" | "personal";
  label: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  profileVersion: number;
  assessmentCode: string;
  sessionCount: number;
  completedCount: number;
  inProgressCount: number;
}

export { invitationStatus, type LinkStatus } from "@/lib/model/invitationStatus";

export const CreateInvitationSchema = z.object({
  kind: z.enum(["shared", "personal"]),
  label: z.string().trim().max(120).default(""),
  expiresInDays: z.number().int().min(1).max(365).nullable().default(null),
});

/** สร้างลิงก์: คืน token ดิบครั้งเดียว (เก็บเฉพาะ hash) */
export async function createInvitation(ctx: OrgContext, roleId: string, input: z.infer<typeof CreateInvitationSchema>) {
  await getRole(ctx.org.id, roleId);
  const confirmed = await getLatestConfirmedVersion(roleId);
  if (!confirmed) throw new ApiError(409, "ต้องยืนยันโปรไฟล์เป้าหมายก่อนสร้างลิงก์", "profile_not_confirmed");
  const assessmentVersionId = await ensureAssessmentVersion();
  const token = generateToken();
  const sql = getSql();
  const expiresAt = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86400_000) : null;
  const rows = await sql<{ id: string }[]>`
    insert into invitations (org_id, role_id, role_profile_version_id, assessment_version_id, kind, token_hash, label, expires_at, created_by)
    values (${ctx.org.id}, ${roleId}, ${confirmed.id}, ${assessmentVersionId}, ${input.kind}, ${hashToken(token)}, ${input.label}, ${expiresAt}, ${ctx.user.id})
    returning id
  `;
  await audit({ orgId: ctx.org.id, actorType: "user", actorId: ctx.user.id, action: "invitation.create", entityType: "invitation", entityId: rows[0].id, meta: { kind: input.kind } });
  return { id: rows[0].id, token, path: `/a/${token}` };
}

export async function listInvitations(orgId: string, roleId: string): Promise<InvitationRow[]> {
  const sql = getSql();
  return sql<InvitationRow[]>`
    select i.id, i.role_id, i.kind, i.label, i.expires_at, i.revoked_at, i.created_at,
      v.version as profile_version, av.code as assessment_code,
      (select count(*)::int from assessment_sessions s where s.invitation_id = i.id) as session_count,
      (select count(*)::int from assessment_sessions s where s.invitation_id = i.id and s.status = 'completed') as completed_count,
      (select count(*)::int from assessment_sessions s where s.invitation_id = i.id and s.status = 'in_progress') as in_progress_count
    from invitations i
    join role_profile_versions v on v.id = i.role_profile_version_id
    join assessment_versions av on av.id = i.assessment_version_id
    where i.org_id = ${orgId} and i.role_id = ${roleId}
    order by i.created_at desc
  `;
}

export async function revokeInvitation(ctx: OrgContext, roleId: string, invitationId: string) {
  const sql = getSql();
  const rows = await sql`
    update invitations set revoked_at = now()
    where id = ${invitationId} and role_id = ${roleId} and org_id = ${ctx.org.id} and revoked_at is null
    returning id
  `;
  if (rows.length === 0) throw new ApiError(404, "ไม่พบลิงก์หรือถูกเพิกถอนแล้ว", "not_found");
  await audit({ orgId: ctx.org.id, actorType: "user", actorId: ctx.user.id, action: "invitation.revoke", entityType: "invitation", entityId: invitationId });
}

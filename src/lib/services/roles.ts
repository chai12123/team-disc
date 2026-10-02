import { z } from "zod";
import { getSql } from "@/lib/db/client";
import { getAIAdapter, AIError, type TranscriptMessage, normalizeAiProfile } from "@/lib/ai";
import { RoleProfileSchema, type RoleProfile } from "@/lib/model/roleProfile";
import { METHODOLOGY_VERSION } from "@/lib/model/versions";
import { ApiError } from "@/lib/util/http";
import { audit } from "@/lib/util/audit";
import { rateLimit } from "@/lib/util/ratelimit";
import type { OrgContext } from "@/lib/auth/server";

export interface RoleRow {
  id: string;
  orgId: string;
  title: string;
  level: string;
  status: "draft" | "discovery" | "profile_review" | "open" | "closed";
  createdAt: string;
  updatedAt: string;
}

export interface RoleSummary extends RoleRow {
  candidateCount: number;
  completedCount: number;
  confirmedVersion: number | null;
}

export interface DiscoveryMessage {
  id: string;
  seq: number;
  sender: "ai" | "recruiter" | "system";
  content: string;
  options: { id: string; text: string; options: string[] }[];
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface ProfileVersionRow {
  id: string;
  roleId: string;
  version: number;
  status: "proposed" | "confirmed" | "superseded";
  profile: RoleProfile;
  methodologyVersion: string;
  source: string;
  confirmedAt: string | null;
  createdAt: string;
}

export const CreateRoleSchema = z.object({
  title: z.string().trim().min(1, "กรุณาระบุชื่อตำแหน่ง").max(200),
  level: z.string().trim().max(100).default(""),
});

export async function listRoles(orgId: string): Promise<RoleSummary[]> {
  const sql = getSql();
  return sql<RoleSummary[]>`
    select r.id, r.org_id, r.title, r.level, r.status, r.created_at, r.updated_at,
      (select count(*)::int from assessment_sessions s where s.role_id = r.id) as candidate_count,
      (select count(*)::int from assessment_sessions s where s.role_id = r.id and s.status = 'completed') as completed_count,
      (select max(version) from role_profile_versions v where v.role_id = r.id and v.status = 'confirmed') as confirmed_version
    from roles r where r.org_id = ${orgId} order by r.created_at desc
  `;
}

export async function createRole(ctx: OrgContext, input: z.infer<typeof CreateRoleSchema>): Promise<RoleRow> {
  const sql = getSql();
  const rows = await sql<RoleRow[]>`
    insert into roles (org_id, title, level, status, created_by)
    values (${ctx.org.id}, ${input.title}, ${input.level}, 'discovery', ${ctx.user.id})
    returning id, org_id, title, level, status, created_at, updated_at
  `;
  await audit({ orgId: ctx.org.id, actorType: "user", actorId: ctx.user.id, action: "role.create", entityType: "role", entityId: rows[0].id });
  return rows[0];
}

/** ดึงตำแหน่ง โดยตรวจว่าเป็นขององค์กรปัจจุบัน (ไม่พบ → 404) */
export async function getRole(orgId: string, roleId: string): Promise<RoleRow> {
  const sql = getSql();
  if (!/^[0-9a-f-]{36}$/.test(roleId)) throw new ApiError(404, "ไม่พบตำแหน่ง", "not_found");
  const rows = await sql<RoleRow[]>`
    select id, org_id, title, level, status, created_at, updated_at from roles where id = ${roleId} and org_id = ${orgId}
  `;
  if (!rows[0]) throw new ApiError(404, "ไม่พบตำแหน่ง", "not_found");
  return rows[0];
}

export async function updateRole(orgId: string, roleId: string, patch: { title?: string; level?: string; status?: RoleRow["status"] }) {
  const sql = getSql();
  const role = await getRole(orgId, roleId);
  await sql`
    update roles set
      title = ${patch.title ?? role.title},
      level = ${patch.level ?? role.level},
      status = ${patch.status ?? role.status}
    where id = ${roleId} and org_id = ${orgId}
  `;
}

export async function listDiscoveryMessages(roleId: string): Promise<DiscoveryMessage[]> {
  const sql = getSql();
  return sql<DiscoveryMessage[]>`
    select id, seq, sender, content, options, meta, created_at from role_discovery_messages
    where role_id = ${roleId} order by seq
  `;
}

async function appendMessage(
  roleId: string,
  sender: DiscoveryMessage["sender"],
  content: string,
  options: unknown[] = [],
  meta: Record<string, unknown> = {},
): Promise<DiscoveryMessage> {
  const sql = getSql();
  const rows = await sql<DiscoveryMessage[]>`
    insert into role_discovery_messages (role_id, seq, sender, content, options, meta)
    values (${roleId}, (select coalesce(max(seq), 0) + 1 from role_discovery_messages where role_id = ${roleId}),
            ${sender}, ${content}, ${sql.json(options as never)}, ${sql.json(meta as never)})
    returning id, seq, sender, content, options, meta, created_at
  `;
  return rows[0];
}

export const DiscoveryInputSchema = z.object({
  message: z.string().trim().max(4000).nullable().optional(),
});

/**
 * รัน 1 รอบของ Role Discovery:
 * บันทึกข้อความผู้รับสมัคร (ถ้ามี) → เรียก AI adapter → บันทึกข้อความ AI →
 * ถ้า AI พร้อมสรุป สร้าง role_profile_versions (status = proposed) จาก JSON ที่ validate แล้ว
 */
export async function runDiscoveryTurn(ctx: OrgContext, roleId: string, message: string | null) {
  const role = await getRole(ctx.org.id, roleId);
  await rateLimit(`ai:discovery:${ctx.org.id}`, 60, 600);
  if (message && message.length > 0) await appendMessage(roleId, "recruiter", message);

  const history = await listDiscoveryMessages(roleId);
  const transcript: TranscriptMessage[] = history
    .filter((m) => m.sender !== "system")
    .map((m) => ({ sender: m.sender as "ai" | "recruiter", content: m.content }));

  const adapter = getAIAdapter();
  let turn;
  try {
    turn = await adapter.discoveryTurn({ roleTitle: role.title, level: role.level, transcript });
  } catch (e) {
    const code = e instanceof AIError ? e.code : "api";
    await audit({ orgId: ctx.org.id, actorType: "system", action: "ai.discovery.failed", entityType: "role", entityId: roleId, meta: { code, provider: adapter.provider } });
    throw new ApiError(502, e instanceof AIError ? e.message : "เรียก AI ไม่สำเร็จ", `ai_${code}`);
  }

  const { content } = turn;
  const aiMessage = await appendMessage(roleId, "ai", content.assistantMessage, content.questions, {
    phase: content.phase,
    conflictsNoticed: content.conflictsNoticed,
    knownGaps: content.knownGaps,
    provider: turn.provider,
    model: turn.model,
  });

  let proposedVersion: ProfileVersionRow | null = null;
  if (content.phase === "ready" && content.proposedProfile) {
    const profile = normalizeAiProfile(content.proposedProfile, role.title);
    proposedVersion = await createProfileVersion(roleId, profile, turn.provider);
    await updateRole(ctx.org.id, roleId, { status: "profile_review" });
  } else if (role.status === "draft") {
    await updateRole(ctx.org.id, roleId, { status: "discovery" });
  }

  await audit({ orgId: ctx.org.id, actorType: "user", actorId: ctx.user.id, action: "ai.discovery.turn", entityType: "role", entityId: roleId, meta: { phase: content.phase, provider: turn.provider } });
  return { aiMessage, phase: content.phase, proposedVersion, provider: turn.provider, model: turn.model };
}

export async function createProfileVersion(roleId: string, profile: RoleProfile, source: string): Promise<ProfileVersionRow> {
  const sql = getSql();
  const rows = await sql<ProfileVersionRow[]>`
    insert into role_profile_versions (role_id, version, status, profile, methodology_version, source)
    values (${roleId}, (select coalesce(max(version), 0) + 1 from role_profile_versions where role_id = ${roleId}),
            'proposed', ${sql.json(profile as never)}, ${profile.methodologyVersion || METHODOLOGY_VERSION}, ${source})
    returning id, role_id, version, status, profile, methodology_version, source, confirmed_at, created_at
  `;
  return rows[0];
}

export async function listProfileVersions(roleId: string): Promise<ProfileVersionRow[]> {
  const sql = getSql();
  return sql<ProfileVersionRow[]>`
    select id, role_id, version, status, profile, methodology_version, source, confirmed_at, created_at
    from role_profile_versions where role_id = ${roleId} order by version desc
  `;
}

export async function getProfileVersion(roleId: string, versionId: string): Promise<ProfileVersionRow> {
  const sql = getSql();
  const rows = await sql<ProfileVersionRow[]>`
    select id, role_id, version, status, profile, methodology_version, source, confirmed_at, created_at
    from role_profile_versions where role_id = ${roleId} and id = ${versionId}
  `;
  if (!rows[0]) throw new ApiError(404, "ไม่พบเวอร์ชันโปรไฟล์", "not_found");
  return rows[0];
}

export async function getLatestConfirmedVersion(roleId: string): Promise<ProfileVersionRow | null> {
  const sql = getSql();
  const rows = await sql<ProfileVersionRow[]>`
    select id, role_id, version, status, profile, methodology_version, source, confirmed_at, created_at
    from role_profile_versions where role_id = ${roleId} and status = 'confirmed' order by version desc limit 1
  `;
  return rows[0] ?? null;
}

export async function getLatestProposedVersion(roleId: string): Promise<ProfileVersionRow | null> {
  const sql = getSql();
  const rows = await sql<ProfileVersionRow[]>`
    select id, role_id, version, status, profile, methodology_version, source, confirmed_at, created_at
    from role_profile_versions where role_id = ${roleId} and status = 'proposed' order by version desc limit 1
  `;
  return rows[0] ?? null;
}

/** บันทึกการแก้ไขของมนุษย์: แก้ร่างที่ยัง proposed ในที่เดิม หรือสร้างร่างใหม่ถ้าเวอร์ชันล่าสุดถูกยืนยันไปแล้ว */
export async function saveProfileDraft(ctx: OrgContext, roleId: string, input: unknown): Promise<ProfileVersionRow> {
  await getRole(ctx.org.id, roleId);
  const profile = RoleProfileSchema.parse(input);
  const sql = getSql();
  const proposed = await getLatestProposedVersion(roleId);
  let row: ProfileVersionRow;
  if (proposed) {
    const rows = await sql<ProfileVersionRow[]>`
      update role_profile_versions set profile = ${sql.json(profile as never)}, source = 'manual'
      where id = ${proposed.id} and status = 'proposed'
      returning id, role_id, version, status, profile, methodology_version, source, confirmed_at, created_at
    `;
    row = rows[0];
  } else {
    row = await createProfileVersion(roleId, profile, "manual");
  }
  await audit({ orgId: ctx.org.id, actorType: "user", actorId: ctx.user.id, action: "profile.draft.save", entityType: "role_profile_version", entityId: row.id });
  return row;
}

/** ยืนยันโปรไฟล์: freeze เวอร์ชัน, เวอร์ชันที่ยืนยันก่อนหน้ากลายเป็น superseded, เปิดรับสมัคร */
export async function confirmProfile(ctx: OrgContext, roleId: string, versionId: string): Promise<ProfileVersionRow> {
  await getRole(ctx.org.id, roleId);
  const v = await getProfileVersion(roleId, versionId);
  if (v.status !== "proposed") throw new ApiError(409, "เวอร์ชันนี้ไม่ได้อยู่ในสถานะร่าง", "conflict");
  RoleProfileSchema.parse(v.profile); // ตรวจซ้ำก่อน freeze
  const sql = getSql();
  const rows = await sql.begin(async (tx) => {
    await tx`update role_profile_versions set status = 'superseded' where role_id = ${roleId} and status = 'confirmed'`;
    const r = await tx<ProfileVersionRow[]>`
      update role_profile_versions set status = 'confirmed', confirmed_by = ${ctx.user.id}, confirmed_at = now()
      where id = ${versionId}
      returning id, role_id, version, status, profile, methodology_version, source, confirmed_at, created_at
    `;
    await tx`update roles set status = 'open' where id = ${roleId}`;
    return r;
  });
  await audit({ orgId: ctx.org.id, actorType: "user", actorId: ctx.user.id, action: "profile.confirm", entityType: "role_profile_version", entityId: versionId, meta: { version: v.version } });
  return rows[0];
}

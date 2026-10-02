import { z } from "zod";
import { getSql } from "@/lib/db/client";
import type { OrgContext } from "@/lib/auth/server";
import { ApiError } from "@/lib/util/http";
import { audit } from "@/lib/util/audit";

export interface MemberRow {
  userId: string;
  email: string | null;
  displayName: string | null;
  role: "org_admin" | "recruiter";
}

export async function listMembers(orgId: string): Promise<MemberRow[]> {
  const sql = getSql();
  return sql<MemberRow[]>`
    select m.user_id, u.email, u.display_name, m.role from memberships m join users u on u.id = m.user_id
    where m.org_id = ${orgId} order by m.created_at
  `;
}

export const UpdateOrgSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  dataRetentionDays: z.number().int().min(30).max(3650).optional(),
});

export async function updateOrg(ctx: OrgContext, input: z.infer<typeof UpdateOrgSchema>) {
  const sql = getSql();
  await sql`
    update organizations set
      name = ${input.name ?? ctx.org.name},
      data_retention_days = ${input.dataRetentionDays ?? ctx.org.dataRetentionDays}
    where id = ${ctx.org.id}
  `;
  await audit({ orgId: ctx.org.id, actorType: "user", actorId: ctx.user.id, action: "org.update", entityType: "organization", entityId: ctx.org.id });
}

/** เพิ่มสมาชิกด้วยอีเมล (ผู้ใช้ต้องเคยเข้าสู่ระบบมาก่อน จึงจะมีแถวใน users) */
export async function addMemberByEmail(ctx: OrgContext, email: string, role: "org_admin" | "recruiter") {
  const sql = getSql();
  const users = await sql<{ id: string }[]>`select id from users where lower(email) = lower(${email})`;
  if (!users[0]) throw new ApiError(404, "ไม่พบผู้ใช้ที่มีอีเมลนี้ (ต้องเข้าสู่ระบบอย่างน้อยหนึ่งครั้งก่อน)", "not_found");
  await sql`
    insert into memberships (org_id, user_id, role) values (${ctx.org.id}, ${users[0].id}, ${role})
    on conflict (org_id, user_id) do update set role = excluded.role
  `;
  await audit({ orgId: ctx.org.id, actorType: "user", actorId: ctx.user.id, action: "member.add", entityType: "user", entityId: users[0].id, meta: { role } });
}

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9ก-๙]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "org";
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}

/** สร้างองค์กรใหม่ให้ผู้ใช้ (เป็น org_admin) */
export async function createOrganizationForUser(userId: string, name: string) {
  const sql = getSql();
  return sql.begin(async (tx) => {
    const org = await tx<{ id: string }[]>`insert into organizations (name, slug) values (${name}, ${slugify(name)}) returning id`;
    await tx`insert into memberships (org_id, user_id, role) values (${org[0].id}, ${userId}, 'org_admin')`;
    return org[0].id;
  });
}

/** dev login: หา/สร้างผู้ใช้ตามอีเมล */
export async function findOrCreateDevUser(email: string, displayName?: string): Promise<string> {
  const sql = getSql();
  const rows = await sql<{ id: string }[]>`
    insert into users (id, email, display_name) values (gen_random_uuid(), ${email.toLowerCase()}, ${displayName ?? null})
    on conflict (email) do update set display_name = coalesce(users.display_name, excluded.display_name)
    returning id
  `;
  return rows[0].id;
}

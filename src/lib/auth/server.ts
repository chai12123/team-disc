import { cookies } from "next/headers";
import { cache } from "react";
import { getSql } from "@/lib/db/client";
import { authMode } from "@/lib/env";
import { ApiError } from "@/lib/util/http";
import { DEV_COOKIE, verifyDevSession } from "./devSession";

export interface CurrentUser {
  id: string;
  email: string | null;
  displayName: string | null;
}

export interface Membership {
  orgId: string;
  orgName: string;
  role: "org_admin" | "recruiter";
  isDemo: boolean;
}

export interface OrgContext {
  user: CurrentUser;
  org: { id: string; name: string; slug: string; dataRetentionDays: number; isDemo: boolean };
  membership: Membership;
  memberships: Membership[];
}

export const ORG_COOKIE = "tf_org";

/** ผู้ใช้ปัจจุบัน (Supabase Auth หรือ dev login) — cache ต่อ request */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const sql = getSql();
  if (authMode() === "supabase") {
    const { createSupabaseServerClient } = await import("./supabase");
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const u = data.user;
    if (!u) return null;
    // sync แถวใน users (id เดียวกับ auth.users)
    const rows = await sql<CurrentUser[]>`
      insert into users (id, email, display_name)
      values (${u.id}, ${u.email ?? null}, ${(u.user_metadata?.display_name as string | undefined) ?? null})
      on conflict (id) do update set email = excluded.email
      returning id, email, display_name
    `;
    return rows[0] ?? null;
  }
  const store = await cookies();
  const userId = verifyDevSession(store.get(DEV_COOKIE)?.value);
  if (!userId) return null;
  const rows = await sql<CurrentUser[]>`select id, email, display_name from users where id = ${userId}`;
  return rows[0] ?? null;
});

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new ApiError(401, "กรุณาเข้าสู่ระบบ", "unauthenticated");
  return u;
}

export async function listMemberships(userId: string): Promise<Membership[]> {
  const sql = getSql();
  return sql<Membership[]>`
    select m.org_id, o.name as org_name, m.role, o.is_demo
    from memberships m join organizations o on o.id = m.org_id
    where m.user_id = ${userId}
    order by o.created_at
  `;
}

/** บริบทองค์กรปัจจุบัน: ตรวจว่าผู้ใช้เป็นสมาชิกจริงเสมอ (server-side) */
export const getOrgContext = cache(async (): Promise<OrgContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const memberships = await listMemberships(user.id);
  if (memberships.length === 0) return null;
  const store = await cookies();
  const wanted = store.get(ORG_COOKIE)?.value;
  const membership = memberships.find((m) => m.orgId === wanted) ?? memberships[0];
  const sql = getSql();
  const orgs = await sql<OrgContext["org"][]>`
    select id, name, slug, data_retention_days, is_demo from organizations where id = ${membership.orgId}
  `;
  if (!orgs[0]) return null;
  return { user, org: orgs[0], membership, memberships };
});

export async function requireOrgContext(): Promise<OrgContext> {
  const ctx = await getOrgContext();
  if (!ctx) throw new ApiError(401, "กรุณาเข้าสู่ระบบและเลือกองค์กร", "unauthenticated");
  return ctx;
}

export async function requireOrgAdmin(): Promise<OrgContext> {
  const ctx = await requireOrgContext();
  if (ctx.membership.role !== "org_admin") throw new ApiError(403, "ต้องเป็นผู้ดูแลองค์กร", "forbidden");
  return ctx;
}

/** ตรวจว่าเอนทิตีเป็นขององค์กรปัจจุบัน ไม่เช่นนั้นตอบ 404 (ไม่เปิดเผยว่ามีอยู่) */
export function assertOrg(entityOrgId: string | null | undefined, ctx: OrgContext): void {
  if (!entityOrgId || entityOrgId !== ctx.org.id) throw new ApiError(404, "ไม่พบข้อมูล", "not_found");
}

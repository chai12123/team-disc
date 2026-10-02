import { getSql } from "@/lib/db/client";

export interface AuditInput {
  orgId?: string | null;
  actorType: "user" | "candidate" | "system";
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
}

/** บันทึกเหตุการณ์สำคัญ (ไม่บันทึกข้อมูลส่วนตัวเต็มชุด) */
export async function audit(input: AuditInput): Promise<void> {
  const sql = getSql();
  try {
    await sql`
      insert into audit_events (org_id, actor_type, actor_id, action, entity_type, entity_id, meta)
      values (${input.orgId ?? null}, ${input.actorType}, ${input.actorId ?? null}, ${input.action},
              ${input.entityType}, ${input.entityId ?? null}, ${sql.json((input.meta ?? {}) as never)})
    `;
  } catch (e) {
    console.error("[audit] failed", e instanceof Error ? e.message : e);
  }
}

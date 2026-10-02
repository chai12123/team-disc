import Link from "next/link";
import type { ReactNode } from "react";
import { requireOrgContext } from "@/lib/auth/server";
import { getRole, getLatestConfirmedVersion } from "@/lib/services/roles";
import { Badge } from "@/components/ui";
import { ROLE_STATUS_LABEL, roleStatusTone } from "@/components/labels";
import { RoleTabs } from "./RoleTabs";

export default async function RoleLayout({ children, params }: { children: ReactNode; params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  const ctx = await requireOrgContext();
  const role = await getRole(ctx.org.id, roleId);
  const confirmed = await getLatestConfirmedVersion(roleId);
  return (
    <>
      <div className="mb-4">
        <Link href="/app/roles" className="text-sm text-muted hover:underline no-print">← ตำแหน่งงานทั้งหมด</Link>
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <h1 className="text-2xl font-semibold tracking-tight">{role.title}</h1>
          <Badge tone={roleStatusTone(role.status)}>{ROLE_STATUS_LABEL[role.status]}</Badge>
          {confirmed && <Badge tone="info">โปรไฟล์ v{confirmed.version} ยืนยันแล้ว</Badge>}
        </div>
        {role.level && <p className="text-sm text-muted">{role.level}</p>}
      </div>
      <RoleTabs roleId={roleId} />
      {children}
    </>
  );
}

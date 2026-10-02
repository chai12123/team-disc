import { requireOrgContext } from "@/lib/auth/server";
import { getRole, getLatestConfirmedVersion } from "@/lib/services/roles";
import { listInvitations } from "@/lib/services/invitations";
import { Alert, Card, LinkButton } from "@/components/ui";
import { InvitationsManager } from "./InvitationsManager";

export const metadata = { title: "ลิงก์สมัคร" };

export default async function InvitationsPage({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  const ctx = await requireOrgContext();
  await getRole(ctx.org.id, roleId);
  const confirmed = await getLatestConfirmedVersion(roleId);
  const invitations = await listInvitations(ctx.org.id, roleId);
  if (!confirmed) {
    return (
      <Card>
        <Alert tone="warning" title="ต้องยืนยันโปรไฟล์เป้าหมายก่อน">ลิงก์สมัครจะผูกกับเวอร์ชันโปรไฟล์ที่ยืนยันแล้ว เพื่อให้ผู้สมัครทุกคนถูกเทียบกับเป้าหมายชุดเดียวกัน</Alert>
        <div className="mt-3"><LinkButton href={`/app/roles/${roleId}/profile`} variant="primary">ไปที่โปรไฟล์เป้าหมาย</LinkButton></div>
      </Card>
    );
  }
  return <InvitationsManager roleId={roleId} initial={invitations} confirmedVersion={confirmed.version} />;
}

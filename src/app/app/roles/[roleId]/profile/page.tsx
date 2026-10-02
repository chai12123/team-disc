import { requireOrgContext } from "@/lib/auth/server";
import { getRole, listProfileVersions } from "@/lib/services/roles";
import { Alert, Card, LinkButton } from "@/components/ui";
import { ProfileEditor } from "./ProfileEditor";

export const metadata = { title: "โปรไฟล์เป้าหมาย" };

export default async function ProfilePage({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  const ctx = await requireOrgContext();
  await getRole(ctx.org.id, roleId);
  const versions = await listProfileVersions(roleId);
  const proposed = versions.find((v) => v.status === "proposed") ?? null;
  const confirmed = versions.find((v) => v.status === "confirmed") ?? null;
  if (versions.length === 0) {
    return (
      <Card>
        <Alert tone="info" title="ยังไม่มีร่างโปรไฟล์">
          เริ่มจากวิเคราะห์งานกับ AI ก่อน ระบบจะเสนอช่วงเป้าหมายและน้ำหนักของ 8 แกนพร้อมเหตุผลจากบทสนทนา
        </Alert>
        <div className="mt-3">
          <LinkButton href={`/app/roles/${roleId}/discovery`} variant="primary">ไปวิเคราะห์งาน</LinkButton>
        </div>
      </Card>
    );
  }
  return <ProfileEditor roleId={roleId} proposed={proposed} confirmed={confirmed} history={versions} />;
}

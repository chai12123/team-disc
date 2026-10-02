import Link from "next/link";
import { requireOrgContext } from "@/lib/auth/server";
import { listRoles } from "@/lib/services/roles";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { ROLE_STATUS_LABEL, roleStatusTone } from "@/components/labels";
import { formatDateTh } from "@/lib/util/format";

export const metadata = { title: "ตำแหน่งงาน" };

export default async function RolesPage() {
  const ctx = await requireOrgContext();
  const roles = await listRoles(ctx.org.id);
  return (
    <>
      <PageHeader title="ตำแหน่งงาน" description="แต่ละตำแหน่งมีโปรไฟล์เป้าหมายของตัวเองที่สร้างจากการวิเคราะห์งาน ไม่ใช่จากชื่อตำแหน่ง" actions={<LinkButton href="/app/roles/new" variant="primary">+ สร้างตำแหน่ง</LinkButton>} />
      {roles.length === 0 ? (
        <EmptyState title="ยังไม่มีตำแหน่งงาน" action={<LinkButton href="/app/roles/new" variant="primary">สร้างตำแหน่งแรก</LinkButton>} />
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">รายการตำแหน่งงาน</caption>
            <thead className="bg-background text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">ตำแหน่ง</th>
                <th scope="col" className="px-4 py-3 font-medium">สถานะ</th>
                <th scope="col" className="px-4 py-3 font-medium">โปรไฟล์ที่ยืนยัน</th>
                <th scope="col" className="px-4 py-3 font-medium">ผู้สมัคร</th>
                <th scope="col" className="px-4 py-3 font-medium">อัปเดต</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {roles.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <Link href={`/app/roles/${r.id}`} className="font-medium hover:underline">{r.title}</Link>
                    <div className="text-xs text-muted">{r.level || "ไม่ระบุระดับ"}</div>
                  </td>
                  <td className="px-4 py-3"><Badge tone={roleStatusTone(r.status)}>{ROLE_STATUS_LABEL[r.status]}</Badge></td>
                  <td className="px-4 py-3">{r.confirmedVersion ? `v${r.confirmedVersion}` : "ยังไม่ยืนยัน"}</td>
                  <td className="px-4 py-3">{r.completedCount}/{r.candidateCount} ทำครบ</td>
                  <td className="px-4 py-3 text-muted">{formatDateTh(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

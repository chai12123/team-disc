import Link from "next/link";
import { requireOrgContext } from "@/lib/auth/server";
import { listRoles } from "@/lib/services/roles";
import { getAIStatus } from "@/lib/ai";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { formatDateTh } from "@/lib/util/format";
import { ROLE_STATUS_LABEL, roleStatusTone } from "@/components/labels";

export const metadata = { title: "แดชบอร์ด" };

export default async function DashboardPage() {
  const ctx = await requireOrgContext();
  const roles = await listRoles(ctx.org.id);
  const ai = getAIStatus();
  const totals = roles.reduce(
    (a, r) => ({ candidates: a.candidates + r.candidateCount, completed: a.completed + r.completedCount, open: a.open + (r.status === "open" ? 1 : 0) }),
    { candidates: 0, completed: 0, open: 0 },
  );
  return (
    <>
      <PageHeader
        title={`สวัสดี, ${ctx.user.displayName ?? ctx.user.email ?? "ผู้ใช้"}`}
        description={<>องค์กร: {ctx.org.name} · AI: {ai.isDemo ? "Demo (scripted)" : `Claude (${ai.model})`}</>}
        actions={<LinkButton href="/app/roles/new" variant="primary">+ สร้างตำแหน่งงาน</LinkButton>}
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          ["ตำแหน่งทั้งหมด", roles.length],
          ["เปิดรับอยู่", totals.open],
          ["ผู้สมัครทั้งหมด", totals.candidates],
          ["ทำแบบประเมินครบ", totals.completed],
        ].map(([label, value]) => (
          <Card key={String(label)} className="py-4">
            <p className="text-xs text-muted">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </Card>
        ))}
      </div>
      <Card>
        <h2 className="font-semibold mb-3">ตำแหน่งล่าสุด</h2>
        {roles.length === 0 ? (
          <EmptyState
            title="ยังไม่มีตำแหน่งงาน"
            description="เริ่มจากสร้างตำแหน่ง แล้วคุยกับ AI เพื่อวิเคราะห์งานและสภาพแวดล้อม ก่อนยืนยันโปรไฟล์เป้าหมาย 8 แกน"
            action={<LinkButton href="/app/roles/new" variant="primary">สร้างตำแหน่งแรก</LinkButton>}
          />
        ) : (
          <ul className="divide-y divide-border">
            {roles.slice(0, 8).map((r) => (
              <li key={r.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <Link href={`/app/roles/${r.id}`} className="font-medium hover:underline">{r.title}</Link>
                  <p className="text-xs text-muted">{r.level || "ไม่ระบุระดับ"} · สร้างเมื่อ {formatDateTh(r.createdAt)}</p>
                </div>
                <Badge tone={roleStatusTone(r.status)}>{ROLE_STATUS_LABEL[r.status]}</Badge>
                <span className="text-sm text-muted">{r.completedCount}/{r.candidateCount} ทำครบ</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

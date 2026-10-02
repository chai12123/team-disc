import { requireOrgContext } from "@/lib/auth/server";
import { getRole, getLatestConfirmedVersion, getLatestProposedVersion, listDiscoveryMessages } from "@/lib/services/roles";
import { listCandidates } from "@/lib/services/candidates";
import { Card, LinkButton } from "@/components/ui";

export default async function RoleOverviewPage({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  const ctx = await requireOrgContext();
  await getRole(ctx.org.id, roleId);
  const [confirmed, proposed, messages, candidates] = await Promise.all([
    getLatestConfirmedVersion(roleId),
    getLatestProposedVersion(roleId),
    listDiscoveryMessages(roleId),
    listCandidates(ctx.org.id, roleId),
  ]);
  const steps = [
    { n: 1, title: "วิเคราะห์งานกับ AI", done: messages.length > 0, href: `/app/roles/${roleId}/discovery`, hint: `${messages.filter((m) => m.sender === "recruiter").length} คำตอบ` },
    { n: 2, title: "ตรวจและยืนยันโปรไฟล์เป้าหมาย 8 แกน", done: Boolean(confirmed), href: `/app/roles/${roleId}/profile`, hint: confirmed ? `ยืนยัน v${confirmed.version}` : proposed ? `มีร่าง v${proposed.version} รอยืนยัน` : "ยังไม่มีร่าง" },
    { n: 3, title: "สร้างลิงก์สมัครและส่งให้ผู้สมัคร", done: candidates.length > 0, href: `/app/roles/${roleId}/invitations`, hint: `${candidates.length} session` },
    { n: 4, title: "ดูผลและเปรียบเทียบผู้สมัคร", done: candidates.some((c) => c.status === "completed"), href: `/app/roles/${roleId}/candidates`, hint: `${candidates.filter((c) => c.status === "completed").length} ทำครบ` },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <h2 className="font-semibold mb-3">ขั้นตอน</h2>
        <ol className="space-y-3">
          {steps.map((s) => (
            <li key={s.n} className="flex items-start gap-3">
              <span aria-hidden className={`mt-0.5 h-6 w-6 shrink-0 rounded-full text-xs flex items-center justify-center border ${s.done ? "bg-success text-white border-success" : "border-border text-muted"}`}>{s.done ? "✓" : s.n}</span>
              <div className="flex-1">
                <p className="font-medium">{s.title} <span className="text-xs text-muted font-normal">· {s.hint}</span></p>
              </div>
              <LinkButton href={s.href} variant="ghost">ไป</LinkButton>
            </li>
          ))}
        </ol>
      </Card>
      <Card>
        <h2 className="font-semibold mb-2">สิ่งที่ระบบนี้แยกให้ชัด</h2>
        <ul className="text-sm space-y-2 list-disc pl-5 text-muted">
          <li><strong className="text-foreground">พฤติกรรมที่ผู้สมัครรายงานด้วยตนเอง</strong> — จากแบบประเมิน 64 ข้อ</li>
          <li><strong className="text-foreground">ทักษะและประสบการณ์จริง</strong> — ต้องตรวจแยกด้วย work sample/สัมภาษณ์</li>
          <li><strong className="text-foreground">ความต้องการของงาน</strong> — โปรไฟล์เป้าหมายที่ยืนยันแล้ว (freeze ตามเวอร์ชัน)</li>
          <li><strong className="text-foreground">ความต้องการส่วนตัวของหัวหน้า</strong> — บันทึกเป็น assumption ไม่ใช่เป้าหมายของงาน</li>
        </ul>
        <p className="text-xs text-muted mt-3">คนที่พฤติกรรมคล้ายหัวหน้าไม่ได้แปลว่าเหมาะกับงานที่สุด และดัชนีความสอดคล้องไม่ใช่โอกาสทำงานสำเร็จ</p>
      </Card>
    </div>
  );
}

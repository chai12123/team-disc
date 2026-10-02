import { requireOrgContext } from "@/lib/auth/server";
import { listMembers } from "@/lib/services/org";
import { listDeletionRequests } from "@/lib/services/candidates";
import { getAIStatus } from "@/lib/ai";
import { authMode } from "@/lib/env";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { SettingsForms } from "./SettingsForms";
import { formatDateTh } from "@/lib/util/format";

export const metadata = { title: "ตั้งค่าองค์กร" };

export default async function SettingsPage() {
  const ctx = await requireOrgContext();
  const [members, deletions] = await Promise.all([listMembers(ctx.org.id), listDeletionRequests(ctx.org.id)]);
  const ai = getAIStatus();
  const isAdmin = ctx.membership.role === "org_admin";
  return (
    <>
      <PageHeader title="ตั้งค่าองค์กรและการเก็บข้อมูล" description={`${ctx.org.name} · บทบาทของคุณ: ${isAdmin ? "ผู้ดูแลองค์กร" : "Recruiter (ดูได้อย่างเดียว)"}`} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold mb-2">สถานะระบบ</h2>
          <dl className="text-sm space-y-1">
            <div className="flex justify-between"><dt className="text-muted">AI provider</dt><dd>{ai.isDemo ? <Badge tone="warning">Demo (scripted)</Badge> : <Badge tone="info">Claude · {ai.model}</Badge>}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Auth</dt><dd>{authMode() === "dev" ? <Badge tone="warning">Dev login</Badge> : <Badge tone="success">Supabase Auth</Badge>}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">ระยะเวลาเก็บข้อมูล</dt><dd>{ctx.org.dataRetentionDays} วัน</dd></div>
          </dl>
        </Card>
        <SettingsForms org={ctx.org} isAdmin={isAdmin} />
        <Card>
          <h2 className="font-semibold mb-2">สมาชิก</h2>
          <ul className="text-sm divide-y divide-border">
            {members.map((m) => (
              <li key={m.userId} className="py-2 flex justify-between gap-2">
                <span>{m.displayName ?? m.email ?? m.userId}</span>
                <Badge tone={m.role === "org_admin" ? "info" : "neutral"}>{m.role === "org_admin" ? "ผู้ดูแล" : "Recruiter"}</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="font-semibold mb-2">คำขอลบข้อมูล</h2>
          {deletions.length === 0 ? (
            <p className="text-sm text-muted">ยังไม่มีคำขอ</p>
          ) : (
            <ul className="text-sm divide-y divide-border">
              {deletions.map((d) => (
                <li key={d.id} className="py-2">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>{d.candidateCode ?? "(ลบแล้ว)"} · {d.roleTitle ?? "-"} · โดย {d.requestedBy === "candidate" ? "ผู้สมัคร" : "องค์กร"}</span>
                    <Badge tone={d.status === "done" ? "success" : "warning"}>{d.status === "done" ? "ดำเนินการแล้ว" : "รอดำเนินการ"}</Badge>
                  </div>
                  <p className="text-xs text-muted">{formatDateTh(d.createdAt)} {d.reason ? `· ${d.reason}` : ""}</p>
                  {d.status !== "done" && d.sessionId && isAdmin && (
                    <form action={`/api/org/deletion-requests`} method="post" className="mt-1">
                      <input type="hidden" name="requestId" value={d.id} />
                      <input type="hidden" name="sessionId" value={d.sessionId} />
                      <button className="text-danger underline text-xs" type="submit">ลบข้อมูลผู้สมัครรายนี้ตอนนี้</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Alert tone="info" className="mt-4">
        ข้อมูลที่เก็บ: คำตอบ เวลา ชื่อ/อีเมล (ถ้ากรอก) และ hash ของ IP ตอนยินยอม · ไม่บันทึกข้อมูลส่วนตัวเต็มชุดลง application logs · ไม่ใช้ข้อมูลอ่อนไหวในการคำนวณ · ผู้สมัครขอลบได้จากหน้าผลของตน
      </Alert>
    </>
  );
}

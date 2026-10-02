"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button, Card, EmptyState, LinkButton } from "@/components/ui";
import type { CandidateListRow } from "@/lib/services/candidates";
import { SESSION_STATUS_LABEL, sessionStatusTone } from "@/components/labels";
import { formatDateTh } from "@/lib/util/format";

export function CandidatesTable({ roleId, rows }: { roleId: string; rows: CandidateListRow[] }) {
  const router = useRouter();
  const [hideNames, setHideNames] = useState(false);
  const [sort, setSort] = useState<"time" | "alignment">("time");
  const [selected, setSelected] = useState<string[]>([]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sort === "alignment") copy.sort((a, b) => (b.overall ?? -1) - (a.overall ?? -1));
    return copy;
  }, [rows, sort]);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]));
  }

  if (rows.length === 0) {
    return <EmptyState title="ยังไม่มีผู้สมัคร" description="สร้างลิงก์สมัครแล้วส่งให้ผู้สมัคร เมื่อมีคนเริ่มทำจะปรากฏที่นี่" action={<LinkButton href={`/app/roles/${roleId}/invitations`} variant="primary">ไปที่ลิงก์สมัคร</LinkButton>} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={hideNames} onChange={(e) => setHideNames(e.target.checked)} /> ซ่อนชื่อ ใช้รหัสผู้สมัคร</label>
        <label className="inline-flex items-center gap-2">
          เรียงตาม
          <select className="border border-border rounded px-2 py-1 bg-surface" value={sort} onChange={(e) => setSort(e.target.value as "time" | "alignment")}>
            <option value="time">เวลาสมัคร (ค่าเริ่มต้น)</option>
            <option value="alignment">ดัชนีต้นแบบ</option>
          </select>
        </label>
        {sort === "alignment" && <Badge tone="warning">เรียงตามดัชนีต้นแบบเท่านั้น ไม่ใช่การจัดอันดับความเหมาะสม</Badge>}
        <span className="ml-auto">เลือกแล้ว {selected.length}/4</span>
        <Button type="button" size="sm" disabled={selected.length < 2} onClick={() => router.push(`/app/roles/${roleId}/compare?ids=${selected.join(",")}`)}>เปรียบเทียบ</Button>
        <a className="text-primary underline text-sm" href={`/api/roles/${roleId}/export.csv`}>ส่งออก CSV</a>
      </div>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">รายชื่อผู้สมัคร</caption>
          <thead className="bg-background text-left">
            <tr>
              <th className="px-3 py-3"><span className="sr-only">เลือก</span></th>
              <th className="px-3 py-3 font-medium">ผู้สมัคร</th>
              <th className="px-3 py-3 font-medium">สถานะ</th>
              <th className="px-3 py-3 font-medium">เวอร์ชัน</th>
              <th className="px-3 py-3 font-medium text-right">ดัชนีความสอดคล้อง*</th>
              <th className="px-3 py-3 font-medium">ส่งเมื่อ</th>
              <th className="px-3 py-3"><span className="sr-only">ดูรายงาน</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((r) => (
              <tr key={r.sessionId}>
                <td className="px-3 py-3">
                  <input type="checkbox" aria-label={`เลือก ${r.candidateCode}`} checked={selected.includes(r.sessionId)} onChange={() => toggle(r.sessionId)} disabled={r.status !== "completed" && !selected.includes(r.sessionId)} />
                </td>
                <td className="px-3 py-3">
                  <div className="font-medium">{hideNames || !r.displayName ? r.candidateCode : r.displayName}</div>
                  {!hideNames && r.displayName && <div className="text-xs text-muted">{r.candidateCode}</div>}
                </td>
                <td className="px-3 py-3">
                  <Badge tone={sessionStatusTone(r.status)}>{SESSION_STATUS_LABEL[r.status]}</Badge>
                  {r.status !== "completed" && <div className="text-xs text-muted mt-1">{r.answeredCount}/64 ข้อ</div>}
                </td>
                <td className="px-3 py-3 text-xs">v{r.profileVersion} · {r.assessmentCode}</td>
                <td className="px-3 py-3 text-right tabular-nums">{r.overall === null ? <span className="text-muted">ยังไม่สมบูรณ์</span> : `${r.overall}%`}</td>
                <td className="px-3 py-3 text-muted">{r.submittedAt ? formatDateTh(r.submittedAt) : "-"}</td>
                <td className="px-3 py-3 text-right"><Link href={`/app/sessions/${r.sessionId}`} className="text-primary underline">รายงาน</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Alert tone="info">*ดัชนีความสอดคล้องด้านพฤติกรรมกับบทบาท คำนวณจากระยะห่างระหว่างคะแนนที่รายงานกับช่วงเป้าหมายตามสูตรของต้นแบบ ไม่ใช่โอกาสทำงานสำเร็จ ไม่มีเกณฑ์ผ่าน/ตก และผู้ที่ดัชนีสูงสุดไม่ได้แปลว่าเหมาะสมที่สุด</Alert>
    </div>
  );
}

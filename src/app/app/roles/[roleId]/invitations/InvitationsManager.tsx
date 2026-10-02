"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card, Input, Label, Select } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import type { InvitationRow } from "@/lib/services/invitations";
import { invitationStatus } from "@/lib/model/invitationStatus";
import { SESSION_STATUS_LABEL, sessionStatusTone } from "@/components/labels";
import { formatDateTh } from "@/lib/util/format";

export function InvitationsManager({ roleId, initial, confirmedVersion }: { roleId: string; initial: InvitationRow[]; confirmedVersion: number }) {
  const [rows, setRows] = useState(initial);
  const [kind, setKind] = useState<"shared" | "personal">("shared");
  const [label, setLabel] = useState("");
  const [expires, setExpires] = useState<string>("30");
  const [created, setCreated] = useState<{ url: string; kind: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/roles/${roleId}/invitations`);
    const json = await res.json();
    if (json.ok) setRows(json.data.invitations);
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/roles/${roleId}/invitations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, label, expiresInDays: expires === "" ? null : Number(expires) }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "สร้างลิงก์ไม่สำเร็จ");
      setCreated({ url: json.data.url, kind });
      setLabel("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "สร้างลิงก์ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm("เพิกถอนลิงก์นี้? ผู้ที่ยังไม่เริ่มจะเปิดไม่ได้อีก (session ที่ทำครบแล้วยังอยู่)")) return;
    const res = await fetch(`/api/roles/${roleId}/invitations/${id}`, { method: "DELETE" });
    if (res.ok) await refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="font-semibold mb-1">สร้างลิงก์สมัคร</h2>
        <p className="text-sm text-muted mb-3">ลิงก์จะผูกกับโปรไฟล์ v{confirmedVersion} และแบบประเมินเวอร์ชันปัจจุบัน ระบบไม่ส่งอีเมลให้ — คัดลอกลิงก์แล้วส่งเองผ่านช่องทางของคุณ</p>
        <div className="grid sm:grid-cols-4 gap-3 items-end">
          <div>
            <Label htmlFor="kind">ประเภท</Label>
            <Select id="kind" value={kind} onChange={(e) => setKind(e.target.value as "shared" | "personal")}>
              <option value="shared">ลิงก์กลาง (หลายคนใช้ แยก session)</option>
              <option value="personal">ลิงก์เฉพาะบุคคล (ใช้เริ่มได้ครั้งเดียว)</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="label" hint="เช่น ช่องทาง JobsDB หรือชื่อย่อผู้สมัคร">ป้ายกำกับ (ไม่บังคับ)</Label>
            <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} />
          </div>
          <div>
            <Label htmlFor="exp">หมดอายุใน (วัน)</Label>
            <Select id="exp" value={expires} onChange={(e) => setExpires(e.target.value)}>
              <option value="7">7 วัน</option>
              <option value="30">30 วัน</option>
              <option value="90">90 วัน</option>
              <option value="">ไม่หมดอายุ</option>
            </Select>
          </div>
          <Button type="button" onClick={create} disabled={busy}>{busy ? "กำลังสร้าง…" : "สร้างลิงก์"}</Button>
        </div>
        {error && <Alert tone="danger" className="mt-3">{error}</Alert>}
        {created && (
          <Alert tone="success" className="mt-3" title="สร้างลิงก์แล้ว — ลิงก์นี้แสดงเต็มครั้งเดียว กรุณาคัดลอกตอนนี้">
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <code className="text-xs break-all bg-surface border border-border rounded px-2 py-1 flex-1 min-w-[200px]">{created.url}</code>
              <CopyButton text={created.url} />
            </div>
            <p className="text-xs mt-2">ระบบเก็บเฉพาะ hash ของลิงก์ หากทำหาย ให้สร้างลิงก์ใหม่และเพิกถอนอันเดิม · ทดสอบในบริบทผู้สมัคร: เปิดลิงก์ในหน้าต่างไม่ระบุตัวตน</p>
          </Alert>
        )}
      </Card>

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">รายการลิงก์</caption>
          <thead className="bg-background text-left">
            <tr>
              <th className="px-4 py-3 font-medium">ลิงก์</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
              <th className="px-4 py-3 font-medium">เวอร์ชัน</th>
              <th className="px-4 py-3 font-medium">การใช้งาน</th>
              <th className="px-4 py-3 font-medium">หมดอายุ</th>
              <th className="px-4 py-3 font-medium"><span className="sr-only">การจัดการ</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">ยังไม่มีลิงก์</td></tr>
            )}
            {rows.map((r) => {
              const st = invitationStatus(r);
              return (
                <tr key={r.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.kind === "shared" ? "ลิงก์กลาง" : "ลิงก์เฉพาะบุคคล"}{r.label ? ` · ${r.label}` : ""}</div>
                    <div className="text-xs text-muted">สร้าง {formatDateTh(r.createdAt)}</div>
                  </td>
                  <td className="px-4 py-3"><Badge tone={sessionStatusTone(st)}>{SESSION_STATUS_LABEL[st]}</Badge></td>
                  <td className="px-4 py-3 text-xs">โปรไฟล์ v{r.profileVersion}<br />{r.assessmentCode}</td>
                  <td className="px-4 py-3">{r.sessionCount} session · ครบ {r.completedCount} · กำลังทำ {r.inProgressCount}</td>
                  <td className="px-4 py-3 text-muted">{r.expiresAt ? formatDateTh(r.expiresAt) : "ไม่หมดอายุ"}</td>
                  <td className="px-4 py-3 text-right">
                    {!r.revokedAt && <Button type="button" variant="danger" size="sm" onClick={() => revoke(r.id)}>เพิกถอน</Button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

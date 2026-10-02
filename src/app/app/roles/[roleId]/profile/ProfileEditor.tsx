"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AXES, AXIS_DEFINITIONS, type AxisKey } from "@/lib/model/axes";
import type { RoleProfile } from "@/lib/model/roleProfile";
import type { ProfileVersionRow } from "@/lib/services/roles";
import { Alert, Badge, Button, Card, Input, Label, Textarea } from "@/components/ui";
import { RadarChart } from "@/components/RadarChart";
import { formatDateTh } from "@/lib/util/format";

interface Props {
  roleId: string;
  proposed: ProfileVersionRow | null;
  confirmed: ProfileVersionRow | null;
  history: ProfileVersionRow[];
}

const linesToArray = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const arrayToLines = (a: string[]) => a.join("\n");

export function ProfileEditor({ roleId, proposed, confirmed, history }: Props) {
  const router = useRouter();
  const editable = proposed !== null;
  const base = (proposed ?? confirmed)!;
  const [p, setP] = useState<RoleProfile>(structuredClone(base.profile));
  const [busy, setBusy] = useState<"save" | "confirm" | null>(null);
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [startNew, setStartNew] = useState(false);

  const weightSum = useMemo(() => AXES.reduce((s, k) => s + p.axes[k].weight, 0), [p]);
  const invalid = AXES.filter((k) => p.axes[k].targetMin > p.axes[k].targetMax);
  const band = {
    min: Object.fromEntries(AXES.map((k) => [k, p.axes[k].targetMin])) as Record<AxisKey, number>,
    max: Object.fromEntries(AXES.map((k) => [k, p.axes[k].targetMax])) as Record<AxisKey, number>,
  };
  const canEdit = editable || startNew;

  function setAxis(k: AxisKey, patch: Partial<RoleProfile["axes"][AxisKey]>) {
    setP((prev) => ({ ...prev, axes: { ...prev.axes, [k]: { ...prev.axes[k], ...patch } } }));
  }

  async function save(): Promise<string | null> {
    setBusy("save");
    setMsg(null);
    try {
      const res = await fetch(`/api/roles/${roleId}/profile`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "บันทึกไม่สำเร็จ");
      setMsg({ tone: "success", text: `บันทึกร่าง v${json.data.version.version} แล้ว` });
      return json.data.version.id as string;
    } catch (e) {
      setMsg({ tone: "danger", text: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function confirm() {
    const id = await save();
    if (!id) return;
    setBusy("confirm");
    try {
      const res = await fetch(`/api/roles/${roleId}/profile/${id}/confirm`, { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "ยืนยันไม่สำเร็จ");
      setMsg({ tone: "success", text: `ยืนยันโปรไฟล์ v${json.data.version.version} แล้ว เวอร์ชันนี้ถูก freeze และใช้กับลิงก์ที่สร้างหลังจากนี้` });
      setShowConfirm(false);
      router.refresh();
      router.push(`/app/roles/${roleId}/invitations`);
    } catch (e) {
      setMsg({ tone: "danger", text: e instanceof Error ? e.message : "ยืนยันไม่สำเร็จ" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {editable ? <Badge tone="warning">ร่าง v{proposed!.version} รอยืนยัน (ที่มา: {proposed!.source})</Badge> : <Badge tone="success">ยืนยันแล้ว v{confirmed!.version} · {formatDateTh(confirmed!.confirmedAt)}</Badge>}
        <Badge tone="neutral">methodology {p.methodologyVersion}</Badge>
        {!editable && !startNew && (
          <Button type="button" variant="secondary" size="sm" onClick={() => setStartNew(true)}>แก้ไขเป็นเวอร์ชันใหม่</Button>
        )}
      </div>
      <Alert tone="info">
        ช่วงเป้าหมายและน้ำหนักเป็น <strong>rubric เชิงทดลอง</strong> ที่ AI เสนอจากบทสนทนา ไม่ใช่ผลวัดบุคลิกขององค์กร คุณปรับได้ทุกค่า เมื่อยืนยันแล้วเวอร์ชันจะถูก freeze และจะไม่เปลี่ยนเงียบ ๆ เมื่อมีผู้สมัครใหม่
      </Alert>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="space-y-4">
          <h2 className="font-semibold">ช่วงเป้าหมาย 8 แกน (0–100) และน้ำหนัก</h2>
          <div className="space-y-4">
            {AXES.map((k) => {
              const a = p.axes[k];
              const bad = a.targetMin > a.targetMax;
              return (
                <fieldset key={k} className="border border-border rounded-[var(--radius)] p-3">
                  <legend className="px-1 text-sm font-medium">{k} · {AXIS_DEFINITIONS[k].nameTh} <span className="text-muted font-normal">— {AXIS_DEFINITIONS[k].description}</span></legend>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor={`${k}-min`}>ต่ำสุด</Label>
                      <Input id={`${k}-min`} type="number" min={0} max={100} step={1} value={a.targetMin} disabled={!canEdit} onChange={(e) => setAxis(k, { targetMin: Number(e.target.value) })} aria-invalid={bad} />
                    </div>
                    <div>
                      <Label htmlFor={`${k}-max`}>สูงสุด</Label>
                      <Input id={`${k}-max`} type="number" min={0} max={100} step={1} value={a.targetMax} disabled={!canEdit} onChange={(e) => setAxis(k, { targetMax: Number(e.target.value) })} aria-invalid={bad} />
                    </div>
                    <div>
                      <Label htmlFor={`${k}-w`} hint="0 = ไม่ใช้แกนนี้">น้ำหนัก</Label>
                      <Input id={`${k}-w`} type="number" min={0} max={10} step={0.5} value={a.weight} disabled={!canEdit} onChange={(e) => setAxis(k, { weight: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div className="mt-2 h-2 rounded bg-background relative" aria-hidden>
                    <div className="absolute inset-y-0 bg-primary/40 rounded" style={{ left: `${Math.min(a.targetMin, a.targetMax)}%`, width: `${Math.abs(a.targetMax - a.targetMin)}%` }} />
                  </div>
                  {bad && <p className="text-xs text-danger mt-1">ต่ำสุดต้องไม่มากกว่าสูงสุด</p>}
                  <div className="mt-2">
                    <Label htmlFor={`${k}-r`}>เหตุผล / ตัวอย่างสถานการณ์</Label>
                    <Textarea id={`${k}-r`} value={a.rationale} disabled={!canEdit} onChange={(e) => setAxis(k, { rationale: e.target.value })} className="min-h-[60px]" />
                  </div>
                  {a.evidenceFromConversation.length > 0 && (
                    <details className="mt-2 text-xs text-muted">
                      <summary className="cursor-pointer">หลักฐานจากบทสนทนา ({a.evidenceFromConversation.length})</summary>
                      <ul className="list-disc pl-5 mt-1 space-y-0.5">
                        {a.evidenceFromConversation.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </fieldset>
              );
            })}
          </div>
          <p className="text-sm">ผลรวมน้ำหนัก: <strong>{weightSum}</strong> {weightSum <= 0 && <span className="text-danger">(ต้องมากกว่า 0)</span>}</p>
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold mb-2">ภาพช่วงเป้าหมาย</h2>
            <RadarChart series={[]} target={{ ...band, label: "ช่วงเป้าหมายของบทบาท (ร่าง)" }} height={280} title="ช่วงเป้าหมายของบทบาท" />
          </Card>
          <Card className="space-y-3">
            <h2 className="font-semibold">สรุปงาน</h2>
            <div>
              <Label htmlFor="title">ชื่อตำแหน่ง</Label>
              <Input id="title" value={p.roleTitle} disabled={!canEdit} onChange={(e) => setP({ ...p, roleTitle: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="level">ระดับ</Label>
              <Input id="level" value={p.level} disabled={!canEdit} onChange={(e) => setP({ ...p, level: e.target.value })} />
            </div>
            {(
              [
                ["responsibilities", "หน้าที่หลัก (บรรทัดละข้อ)"],
                ["successOutcomes", "ผลลัพธ์ที่คาดหวัง / 90 วันแรก"],
                ["requiredSkills", "ทักษะที่ต้องตรวจแยกจากแบบประเมินนี้"],
                ["unresolvedQuestions", "สิ่งที่ยังไม่ทราบ / ควรถามเพิ่ม"],
                ["assumptions", "สมมติฐาน (รวมความต้องการส่วนตัวของหัวหน้า)"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <Label htmlFor={key}>{label}</Label>
                <Textarea id={key} value={arrayToLines(p[key])} disabled={!canEdit} onChange={(e) => setP({ ...p, [key]: linesToArray(e.target.value) })} />
              </div>
            ))}
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">บริบทการทำงาน</summary>
              <div className="space-y-2 mt-2">
                {(
                  [
                    ["decisionSpeed", "ความเร็วในการตัดสินใจ"],
                    ["costOfError", "ความเสียหายเมื่อพลาด"],
                    ["routineVsChange", "งานประจำ vs งานที่เปลี่ยน"],
                    ["authorityLevel", "อำนาจตัดสินใจ"],
                    ["teamAndManagerStyle", "หัวหน้าและทีมทำงานอย่างไร"],
                    ["supportAvailable", "การสนับสนุนจากองค์กร"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <Label htmlFor={key}>{label}</Label>
                    <Input id={key} value={p.workContext[key]} disabled={!canEdit} onChange={(e) => setP({ ...p, workContext: { ...p.workContext, [key]: e.target.value } })} />
                  </div>
                ))}
                <div>
                  <Label htmlFor="frequentSituations">สถานการณ์ที่เจอบ่อย (บรรทัดละข้อ)</Label>
                  <Textarea id="frequentSituations" value={arrayToLines(p.workContext.frequentSituations)} disabled={!canEdit} onChange={(e) => setP({ ...p, workContext: { ...p.workContext, frequentSituations: linesToArray(e.target.value) } })} />
                </div>
              </div>
            </details>
          </Card>
        </div>
      </div>

      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {canEdit && (
        <div className="flex flex-wrap gap-2 items-center sticky bottom-0 bg-background/95 py-3 border-t border-border">
          <Button type="button" variant="secondary" disabled={busy !== null || invalid.length > 0 || weightSum <= 0} onClick={() => save()}>
            {busy === "save" ? "กำลังบันทึก…" : "บันทึกร่าง"}
          </Button>
          {!showConfirm ? (
            <Button type="button" disabled={busy !== null || invalid.length > 0 || weightSum <= 0} onClick={() => setShowConfirm(true)}>ยืนยันโปรไฟล์และเปิดรับสมัคร</Button>
          ) : (
            <span className="flex flex-wrap items-center gap-2 text-sm">
              <span>ยืนยันแล้วจะ freeze เวอร์ชันนี้ ลิงก์ที่สร้างหลังจากนี้จะใช้เวอร์ชันนี้ ดำเนินการ?</span>
              <Button type="button" onClick={confirm} disabled={busy !== null}>{busy === "confirm" ? "กำลังยืนยัน…" : "ยืนยัน"}</Button>
              <Button type="button" variant="ghost" onClick={() => setShowConfirm(false)}>ยกเลิก</Button>
            </span>
          )}
        </div>
      )}

      {history.length > 1 && (
        <Card>
          <h2 className="font-semibold mb-2">ประวัติเวอร์ชัน</h2>
          <ul className="text-sm divide-y divide-border">
            {history.map((v) => (
              <li key={v.id} className="py-2 flex flex-wrap gap-2 items-center">
                <span>v{v.version}</span>
                <Badge tone={v.status === "confirmed" ? "success" : v.status === "proposed" ? "warning" : "neutral"}>{v.status}</Badge>
                <span className="text-muted">ที่มา: {v.source} · สร้าง {formatDateTh(v.createdAt)}{v.confirmedAt ? ` · ยืนยัน ${formatDateTh(v.confirmedAt)}` : ""}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

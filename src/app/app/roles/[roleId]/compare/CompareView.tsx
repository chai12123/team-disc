"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AXES, AXIS_DEFINITIONS, type AxisKey } from "@/lib/model/axes";
import type { ComparisonResult } from "@/lib/services/candidates";
import { Alert, Badge, Card, Disclaimer } from "@/components/ui";
import { RadarChart } from "@/components/RadarChart";
import { PrintButton } from "@/components/PrintButton";
import { formatDateTh } from "@/lib/util/format";

export function CompareView({ roleId, result }: { roleId: string; result: ComparisonResult }) {
  const [hideNames, setHideNames] = useState(true);
  const [mode, setMode] = useState<"small" | "overlay">("small");
  const [sort, setSort] = useState<"time" | "alignment">("time");
  const [overlaySel, setOverlaySel] = useState<string[]>(result.comparable.slice(0, 3).map((r) => r.sessionId));

  const rows = useMemo(() => {
    const copy = [...result.comparable];
    if (sort === "alignment") copy.sort((a, b) => (b.overall ?? 0) - (a.overall ?? 0));
    return copy;
  }, [result.comparable, sort]);

  const band = result.targets
    ? {
        min: Object.fromEntries(result.targets.map((t) => [t.axis, t.targetMin])) as Record<AxisKey, number>,
        max: Object.fromEntries(result.targets.map((t) => [t.axis, t.targetMax])) as Record<AxisKey, number>,
        label: `โปรไฟล์เป้าหมาย v${result.referenceProfileVersion} (องค์กรกำหนด)`,
      }
    : null;
  const nameOf = (r: ComparisonResult["comparable"][number]) => (hideNames || !r.displayName ? r.candidateCode : `${r.displayName} (${r.candidateCode})`);
  const colorIndex = (sessionId: string) => result.comparable.findIndex((r) => r.sessionId === sessionId);

  // จุดแข็งที่แตกต่าง: แกนที่ผู้สมัครคนนี้รายงานสูงกว่าคนอื่นในกลุ่มชัดเจน (≥ 15 จุด)
  const distinct = rows.map((r) => {
    const axes = AXES.filter((k) => {
      const mine = r.scaleScores![k];
      return rows.every((o) => o.sessionId === r.sessionId || mine - o.scaleScores![k] >= 15);
    });
    const toAsk = r.alignment!.axes.filter((a) => a.distance > 0 && a.weight > 0).sort((a, b) => b.distance * b.weight - a.distance * a.weight).slice(0, 2);
    return { r, axes, toAsk };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/app/roles/${roleId}/candidates`} className="text-muted hover:underline no-print">← เลือกผู้สมัครใหม่</Link>
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={hideNames} onChange={(e) => setHideNames(e.target.checked)} /> ใช้รหัสผู้สมัครแทนชื่อ</label>
        <label className="inline-flex items-center gap-2">
          มุมมอง
          <select className="border border-border rounded px-2 py-1 bg-surface" value={mode} onChange={(e) => setMode(e.target.value as "small" | "overlay")}>
            <option value="small">กราฟแยกราย คน (ค่าเริ่มต้น)</option>
            <option value="overlay">ซ้อนกัน (สูงสุด 3 เส้น)</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-2">
          เรียงตาม
          <select className="border border-border rounded px-2 py-1 bg-surface" value={sort} onChange={(e) => setSort(e.target.value as "time" | "alignment")}>
            <option value="time">เวลาสมัคร</option>
            <option value="alignment">ดัชนีต้นแบบ</option>
          </select>
        </label>
        {sort === "alignment" && <Badge tone="warning">เรียงตามดัชนีต้นแบบเท่านั้น ไม่ใช่อันดับความเหมาะสม</Badge>}
        <span className="ml-auto"><PrintButton /></span>
      </div>

      {result.excluded.length > 0 && (
        <Alert tone="warning" title="ผู้สมัครที่ไม่รวมในการเปรียบเทียบ">
          <ul className="list-disc pl-5">
            {result.excluded.map((e) => (
              <li key={e.row.sessionId}>{nameOf(e.row)}: {e.reason}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs">เปรียบเทียบได้เฉพาะผู้ที่ใช้โปรไฟล์เป้าหมายและแบบประเมินเวอร์ชันเดียวกัน (อ้างอิง: โปรไฟล์ v{result.referenceProfileVersion} · {result.referenceAssessmentCode})</p>
        </Alert>
      )}

      {rows.length < 2 ? (
        <Alert tone="info">เหลือผู้สมัครที่เปรียบเทียบได้ไม่ถึง 2 คน</Alert>
      ) : (
        <>
          {mode === "small" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {rows.map((r) => (
                <Card key={r.sessionId}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h2 className="font-semibold">{nameOf(r)}</h2>
                    <span className="text-sm tabular-nums">ดัชนี {r.overall}%</span>
                  </div>
                  <RadarChart series={[{ name: nameOf(r), values: r.scaleScores!, colorIndex: colorIndex(r.sessionId) }]} target={band} height={240} title={`โปรไฟล์ ${nameOf(r)}`} />
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <div className="flex flex-wrap gap-2 mb-2 text-sm">
                {rows.map((r) => {
                  const on = overlaySel.includes(r.sessionId);
                  return (
                    <label key={r.sessionId} className="inline-flex items-center gap-1">
                      <input type="checkbox" checked={on} disabled={!on && overlaySel.length >= 3} onChange={() => setOverlaySel((s) => (on ? s.filter((x) => x !== r.sessionId) : [...s, r.sessionId]))} />
                      {nameOf(r)}
                    </label>
                  );
                })}
                <span className="text-xs text-muted">(เลือกได้ไม่เกิน 3 เส้นเพื่อให้อ่านได้)</span>
              </div>
              <RadarChart series={rows.filter((r) => overlaySel.includes(r.sessionId)).map((r) => ({ name: nameOf(r), values: r.scaleScores!, colorIndex: colorIndex(r.sessionId) }))} target={band} height={380} title="เปรียบเทียบซ้อนกัน" />
            </Card>
          )}

          <Card className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="text-left text-xs text-muted px-4 pt-3">คะแนน 8 แกน (คะแนนที่รายงาน / สอดคล้องรายแกน) และดัชนีรวม — เรียงตาม{sort === "time" ? "เวลาสมัคร" : "ดัชนีต้นแบบ"}</caption>
              <thead className="bg-background text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">แกน</th>
                  {result.targets && <th className="px-3 py-2 font-medium">ช่วงเป้าหมาย (น้ำหนัก)</th>}
                  {rows.map((r) => (
                    <th key={r.sessionId} className="px-3 py-2 font-medium">{nameOf(r)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {AXES.map((k) => {
                  const t = result.targets?.find((x) => x.axis === k);
                  return (
                    <tr key={k}>
                      <th scope="row" className="px-3 py-2 text-left font-medium">{k} <span className="text-muted font-normal">{AXIS_DEFINITIONS[k].nameTh}</span></th>
                      {t && <td className="px-3 py-2 tabular-nums">{t.targetMin}–{t.targetMax} ({t.weight})</td>}
                      {rows.map((r) => {
                        const a = r.alignment!.axes.find((x) => x.axis === k)!;
                        return (
                          <td key={r.sessionId} className="px-3 py-2 tabular-nums">
                            {r.scaleScores![k]} <span className="text-muted">/ {Math.round(a.alignment)}</span>
                            {a.position !== "within" && <span className="text-xs text-muted"> ({a.position === "below" ? "ต่ำกว่า" : "สูงกว่า"})</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr className="bg-background font-medium">
                  <th scope="row" className="px-3 py-2 text-left">ดัชนีความสอดคล้องรวม</th>
                  {result.targets && <td className="px-3 py-2" />}
                  {rows.map((r) => (
                    <td key={r.sessionId} className="px-3 py-2 tabular-nums">{r.overall}%</td>
                  ))}
                </tr>
                <tr className="text-xs text-muted">
                  <th scope="row" className="px-3 py-2 text-left font-normal">ส่งเมื่อ</th>
                  {result.targets && <td className="px-3 py-2" />}
                  {rows.map((r) => (
                    <td key={r.sessionId} className="px-3 py-2">{formatDateTh(r.submittedAt)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            {distinct.map(({ r, axes, toAsk }) => (
              <Card key={r.sessionId} className="text-sm">
                <h3 className="font-semibold mb-1">{nameOf(r)}</h3>
                <p className="text-xs text-muted">จุดแข็งที่แตกต่างในกลุ่มนี้ (รายงานสูงกว่าคนอื่น ≥ 15 จุด)</p>
                <p>{axes.length > 0 ? axes.map((k) => `${k} ${AXIS_DEFINITIONS[k].nameTh}`).join(", ") : "ไม่มีแกนที่ต่างจากคนอื่นชัดเจน"}</p>
                <p className="text-xs text-muted mt-2">เรื่องที่ควรสัมภาษณ์เพิ่ม (ห่างจากช่วงเป้าหมายมากที่สุดเมื่อถ่วงน้ำหนัก)</p>
                <ul className="list-disc pl-5">
                  {toAsk.length === 0 && <li>ทุกแกนที่มีน้ำหนักอยู่ในช่วงเป้าหมาย — ยังควรตรวจทักษะและประสบการณ์แยก</li>}
                  {toAsk.map((a) => (
                    <li key={a.axis}>{a.axis} {AXIS_DEFINITIONS[a.axis].nameTh}: รายงาน {a.candidateScore} {a.position === "below" ? "ต่ำกว่า" : "สูงกว่า"}ช่วง {a.targetMin}–{a.targetMax}</li>
                  ))}
                </ul>
                <Link href={`/app/sessions/${r.sessionId}`} className="text-primary underline text-xs">ดูรายงานฉบับเต็ม</Link>
              </Card>
            ))}
          </div>
        </>
      )}
      <Disclaimer>หน้านี้ไม่มีป้าย “ผู้สมัครที่ดีที่สุด” หรือ “รับ/ไม่รับ” ดัชนีเป็น heuristic ของต้นแบบที่ขึ้นกับช่วงเป้าหมายและน้ำหนักที่องค์กรกำหนด ใช้เพื่อเตรียมคำถามสัมภาษณ์และแผน onboarding ไม่ใช่เพื่อตัดสินอัตโนมัติ</Disclaimer>
    </div>
  );
}

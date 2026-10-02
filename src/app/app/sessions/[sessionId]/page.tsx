import Link from "next/link";
import { requireOrgContext } from "@/lib/auth/server";
import { getSessionForOrg, getScoreReport, getAiReport, listNotes } from "@/lib/services/reports";
import { AXES, type AxisKey } from "@/lib/model/axes";
import { Alert, Badge, Card, Disclaimer } from "@/components/ui";
import { RadarChart } from "@/components/RadarChart";
import { ScoreTable } from "@/components/ScoreTable";
import { AlignmentBreakdown } from "@/components/AlignmentBreakdown";
import { PrintButton } from "@/components/PrintButton";
import { SESSION_STATUS_LABEL, sessionStatusTone } from "@/components/labels";
import { formatDateTh, formatDuration } from "@/lib/util/format";
import { getAIStatus } from "@/lib/ai";
import { OrgAiReport } from "./OrgAiReport";
import { NotesPanel } from "./NotesPanel";

export const metadata = { title: "รายงานผู้สมัคร" };

export default async function SessionReportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const ctx = await requireOrgContext();
  const s = await getSessionForOrg(ctx.org.id, sessionId);
  const [score, ai, notes] = await Promise.all([getScoreReport(sessionId), getAiReport(sessionId, "organization"), listNotes(ctx.org.id, sessionId)]);
  const aiStatus = getAIStatus();
  const band = {
    min: Object.fromEntries(AXES.map((k) => [k, s.profile.axes[k].targetMin])) as Record<AxisKey, number>,
    max: Object.fromEntries(AXES.map((k) => [k, s.profile.axes[k].targetMax])) as Record<AxisKey, number>,
    label: `โปรไฟล์เป้าหมายของบทบาท v${s.profileVersion} (องค์กรกำหนด)`,
  };
  const q = score?.responseQuality;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href={`/app/roles/${s.roleId}/candidates`} className="text-sm text-muted hover:underline no-print">← ผู้สมัครของ {s.roleTitle}</Link>
          <h1 className="text-2xl font-semibold tracking-tight">รายงาน {s.displayName ?? s.candidateCode} <span className="text-base text-muted font-normal">({s.candidateCode})</span></h1>
          <div className="flex flex-wrap gap-2 items-center text-xs text-muted mt-1">
            <Badge tone={sessionStatusTone(s.status)}>{SESSION_STATUS_LABEL[s.status]}</Badge>
            <span>ตำแหน่ง: {s.roleTitle} · โปรไฟล์ v{s.profileVersion} · {s.assessmentCode}{score ? ` · ${score.scoringVersion}` : ""}</span>
            {s.submittedAt && <span>· ส่งเมื่อ {formatDateTh(s.submittedAt)}</span>}
          </div>
        </div>
        <PrintButton />
      </div>

      {!score ? (
        <Alert tone="warning" title="ยังไม่สมบูรณ์">
          ผู้สมัครตอบแล้ว {s.answeredCount}/64 ข้อ ระบบจะคำนวณคะแนนเมื่อครบทั้ง 64 ข้อเท่านั้น และไม่เติมคำตอบแทน (บันทึกล่าสุด {formatDateTh(s.lastSavedAt)})
        </Alert>
      ) : (
        <>
          <Card>
            <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-6">
              <div>
                <p className="text-sm text-muted">ดัชนีความสอดคล้องด้านพฤติกรรมกับบทบาท</p>
                <p className="text-4xl font-semibold tabular-nums">{score.alignment.overall}%</p>
              </div>
              <p className="text-xs text-muted max-w-xl">ค่านี้แสดงความใกล้กับช่วงพฤติกรรมที่องค์กรกำหนดตามสูตรของต้นแบบ ไม่ใช่เปอร์เซ็นต์โอกาสทำงานสำเร็จหรือคะแนนความสามารถ ไม่มีเกณฑ์ผ่าน/ตก</p>
            </div>
            <div className="mt-3">
              <AlignmentBreakdown alignment={score.alignment} scoringVersion={score.scoringVersion} profileVersion={s.profileVersion} />
            </div>
          </Card>
          <Card>
            <h2 className="font-semibold mb-1">กราฟเป้าหมายซ้อนกับผู้สมัคร</h2>
            <p className="text-xs text-muted mb-2">สองชุดนี้มาจากคนละแหล่ง: แถบสีเทาคือ rubric ที่องค์กรกำหนดจากการวิเคราะห์งาน เส้นสีคือพฤติกรรมที่ผู้สมัครรายงานด้วยตนเอง การเทียบเป็นการเทียบเชิงทดลอง</p>
            <RadarChart series={[{ name: `พฤติกรรมที่ผู้สมัครรายงาน (${s.candidateCode})`, values: score.scaleScores }]} target={band} height={340} title="เป้าหมายซ้อนผู้สมัคร" />
            <ScoreTable scores={score.scaleScores} alignment={score.alignment} showTendency />
          </Card>
          {q && (
            <Card>
              <h2 className="font-semibold mb-2">คุณภาพการตอบ (แยกจากดัชนี — เป็นข้อสังเกต ไม่ใช่ข้อสรุปว่าผู้สมัครโกหก)</h2>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><dt className="text-muted text-xs">ทำครบ</dt><dd>{q.complete ? "ครบ 64 ข้อ" : `${q.answeredCount}/${q.totalCount}`}</dd></div>
                <div><dt className="text-muted text-xs">ระยะเวลาที่ใช้</dt><dd>{formatDuration(q.durationSeconds)}</dd></div>
                <div><dt className="text-muted text-xs">เลือกค่าเดิมติดกันยาวสุด</dt><dd>{q.longestSameValueRun} ข้อ</dd></div>
                <div><dt className="text-muted text-xs">ความต่างเฉลี่ยของคู่ข้อที่กำหนด</dt><dd>{q.meanPairDifference === null ? "-" : q.meanPairDifference.toFixed(2)} (0–4)</dd></div>
              </dl>
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-muted">รายละเอียดคู่ข้อและการกระจายคำตอบ</summary>
                <p className="mt-1">การกระจาย: {([1, 2, 3, 4, 5] as const).map((v) => `${v}: ${q.distribution[v]}`).join(" · ")} · สัดส่วนค่าที่ใช้บ่อยสุด {(q.mostFrequentValueShare * 100).toFixed(0)}%</p>
                <ul className="mt-1 list-disc pl-5">
                  {q.pairDifferences.map((p) => (
                    <li key={p.pairGroup}>{p.pairGroup} ({p.itemIds.join(" / ")}): ต่าง {p.difference}</li>
                  ))}
                </ul>
              </details>
              {q.notes.length > 0 && (
                <ul className="mt-2 text-sm list-disc pl-5 text-muted">
                  {q.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
            </Card>
          )}
          <OrgAiReport sessionId={sessionId} initial={ai} isDemo={aiStatus.isDemo} />
        </>
      )}

      <Card>
        <h2 className="font-semibold mb-2">บริบทของบทบาท (จากโปรไฟล์ v{s.profileVersion})</h2>
        <dl className="grid sm:grid-cols-2 gap-3 text-sm">
          <div><dt className="text-muted text-xs">หน้าที่หลัก</dt><dd>{s.profile.responsibilities.join("; ") || "-"}</dd></div>
          <div><dt className="text-muted text-xs">ผลลัพธ์ที่คาดหวัง</dt><dd>{s.profile.successOutcomes.join("; ") || "-"}</dd></div>
          <div><dt className="text-muted text-xs">ทักษะที่ต้องตรวจแยก</dt><dd>{s.profile.requiredSkills.join("; ") || "-"}</dd></div>
          <div><dt className="text-muted text-xs">สมมติฐาน / ความต้องการของหัวหน้า</dt><dd>{s.profile.assumptions.join("; ") || "-"}</dd></div>
        </dl>
      </Card>

      <NotesPanel sessionId={sessionId} initial={notes} canDelete={ctx.membership.role === "org_admin"} roleId={s.roleId} />
      <Disclaimer />
    </div>
  );
}

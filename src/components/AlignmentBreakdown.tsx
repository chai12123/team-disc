import { AXIS_DEFINITIONS } from "@/lib/model/axes";
import type { AlignmentResult } from "@/lib/scoring";

/** เปิดดูที่มาของดัชนี: สูตร, คะแนนรายแกน, ช่วง, น้ำหนัก, ระยะห่าง, contribution */
export function AlignmentBreakdown({ alignment, scoringVersion, profileVersion }: { alignment: AlignmentResult; scoringVersion: string; profileVersion: number }) {
  return (
    <details className="rounded-[var(--radius)] border border-border bg-background p-3 text-sm">
      <summary className="cursor-pointer font-medium">ดูวิธีคำนวณดัชนี ({scoringVersion} · โปรไฟล์ v{profileVersion})</summary>
      <div className="mt-3 space-y-3">
        <div className="font-mono text-xs bg-surface border border-border rounded p-2 overflow-x-auto">
          <div>distance_j = max(targetMin_j − c_j, 0, c_j − targetMax_j)</div>
          <div>alignment_j = 100 − distance_j</div>
          <div>overall = Σ(w_j × alignment_j) / Σ(w_j) = {Math.round(alignment.overallRaw * 100) / 100} → แสดง {alignment.overall}% (ปัดเป็นจำนวนเต็ม)</div>
          <div>Σ(w_j) = {alignment.weightSum}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left">
              <tr>
                <th className="px-2 py-1">แกน</th>
                <th className="px-2 py-1 text-right">c_j</th>
                <th className="px-2 py-1 text-right">ช่วง</th>
                <th className="px-2 py-1 text-right">w_j</th>
                <th className="px-2 py-1 text-right">distance</th>
                <th className="px-2 py-1 text-right">alignment_j</th>
                <th className="px-2 py-1 text-right">contribution (w·a/Σw)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {alignment.axes.map((a) => (
                <tr key={a.axis}>
                  <td className="px-2 py-1">{a.axis} {AXIS_DEFINITIONS[a.axis].nameTh}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{a.candidateScore}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{a.targetMin}–{a.targetMax}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{a.weight}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{Math.round(a.distance * 10) / 10}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{Math.round(a.alignment * 10) / 10}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{Math.round(a.contribution * 100) / 100}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">
          ช่วงเป้าหมายที่กว้างทำให้ระยะห่างเป็น 0 ได้ง่ายขึ้น และน้ำหนักที่เปลี่ยนทำให้ผลรวมเปลี่ยนได้ ค่านี้จึงขึ้นกับ rubric ที่องค์กรกำหนด ไม่ใช่คุณสมบัติคงที่ของผู้สมัคร
        </p>
      </div>
    </details>
  );
}

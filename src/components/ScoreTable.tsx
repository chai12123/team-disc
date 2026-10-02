import { AXES, AXIS_DEFINITIONS, type AxisKey } from "@/lib/model/axes";
import type { AlignmentResult } from "@/lib/scoring";

interface Props {
  scores: Record<AxisKey, number>;
  alignment?: AlignmentResult | null;
  caption?: string;
  showTendency?: boolean;
}

/** ตารางคะแนนที่อ่านได้โดยไม่ต้องดูกราฟ */
export function ScoreTable({ scores, alignment, caption, showTendency }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="text-left text-xs text-muted mb-2">{caption ?? "คะแนนตามสเกลของต้นแบบ (0–100) จากคำตอบที่ผู้สมัครรายงานด้วยตนเอง"}</caption>
        <thead className="text-left bg-background">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">แกน</th>
            <th scope="col" className="px-3 py-2 font-medium text-right">คะแนนที่รายงาน</th>
            {alignment && (
              <>
                <th scope="col" className="px-3 py-2 font-medium text-right">ช่วงเป้าหมาย</th>
                <th scope="col" className="px-3 py-2 font-medium text-right">น้ำหนัก</th>
                <th scope="col" className="px-3 py-2 font-medium text-right">ระยะห่าง</th>
                <th scope="col" className="px-3 py-2 font-medium text-right">สอดคล้องรายแกน</th>
              </>
            )}
            {showTendency && <th scope="col" className="px-3 py-2 font-medium">แนวโน้มที่อาจเห็น</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {AXES.map((k) => {
            const a = alignment?.axes.find((x) => x.axis === k);
            const s = scores[k];
            return (
              <tr key={k}>
                <th scope="row" className="px-3 py-2 font-medium text-left">
                  {k} <span className="text-muted font-normal">{AXIS_DEFINITIONS[k].nameTh}</span>
                </th>
                <td className="px-3 py-2 text-right tabular-nums">{s}</td>
                {alignment && a && (
                  <>
                    <td className="px-3 py-2 text-right tabular-nums">{a.targetMin}–{a.targetMax}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.weight}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {a.distance === 0 ? "0" : `${a.position === "below" ? "ต่ำกว่า" : "สูงกว่า"} ${Math.round(a.distance * 10) / 10}`}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{Math.round(a.alignment)}</td>
                  </>
                )}
                {showTendency && (
                  <td className="px-3 py-2 text-muted text-xs">
                    {s >= 65 ? AXIS_DEFINITIONS[k].highTendency : s <= 35 ? AXIS_DEFINITIONS[k].lowTendency : "ช่วงกลาง: อาจปรับตามสถานการณ์"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

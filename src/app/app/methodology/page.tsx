import { requireOrgContext } from "@/lib/auth/server";
import { AXIS_LIST } from "@/lib/model/axes";
import { ITEM_BANK, LIKERT_LABELS, RESPONSE_FRAME } from "@/lib/assessment/items";
import { ASSESSMENT_VERSION_CODE, METHODOLOGY_VERSION, SCORING_VERSION } from "@/lib/model/versions";
import { Alert, Card, PageHeader } from "@/components/ui";

export const metadata = { title: "สูตรคะแนนและข้อจำกัด" };

export default async function MethodologyPage() {
  await requireOrgContext();
  return (
    <>
      <PageHeader title="สูตรคะแนนและข้อจำกัดของต้นแบบ" description={`${ASSESSMENT_VERSION_CODE} · ${SCORING_VERSION} · ${METHODOLOGY_VERSION}`} />
      <div className="space-y-4 text-sm">
        <Alert tone="warning" title="สถานะของเครื่องมือ">
          MVP นี้ยังไม่ได้ผ่าน psychometric validation สูตร alignment เป็น heuristic ของผลิตภัณฑ์ ก่อนนำไปใช้เป็นเครื่องมือคัดเลือกที่มีผลต่อการจ้างจริง ต้องตรวจ job relevance, reliability, validity และ fairness รวมถึงเปรียบเทียบกับหลักฐานทักษะและผลการทำงาน
        </Alert>
        <Card>
          <h2 className="font-semibold mb-2">8 แกนพฤติกรรม (operational definitions)</h2>
          <ul className="space-y-1">
            {AXIS_LIST.map((a) => (
              <li key={a.key}><strong>{a.key}</strong> {a.nameTh}: {a.description}</li>
            ))}
          </ul>
          <p className="text-muted mt-2">แกนผสม (Di, iS, SC, CD) มีข้อคำถามวัดโดยตรง ไม่ได้สร้างจากค่าเฉลี่ยของสองแกน · คะแนนสูงไม่ได้ดีกว่า ต่ำไม่ได้ขาดความสามารถ · ไม่ตีความความฉลาด คุณธรรม หรือสุขภาพจิต</p>
        </Card>
        <Card>
          <h2 className="font-semibold mb-2">การคำนวณ (ทำด้วยโค้ดฝั่ง server เท่านั้น)</h2>
          <pre className="font-mono text-xs bg-background border border-border rounded p-3 overflow-x-auto">{`ข้อปกติ:        scored = r
ข้อกลับคะแนน:  scored = 6 − r
scaleScore_j = 100 × (mean(scored ของแกน j) − 1) / 4        // "คะแนนตามสเกลของต้นแบบ" ไม่ใช่ percentile

distance_j   = max(targetMin_j − c_j, 0, c_j − targetMax_j)
alignment_j  = 100 − distance_j
overall      = Σ(w_j × alignment_j) / Σ(w_j)                 // w_j ≥ 0, Σw_j > 0, แสดงเป็นจำนวนเต็ม`}</pre>
          <ul className="list-disc pl-5 mt-2 text-muted space-y-1">
            <li>คำนวณเมื่อครบทั้ง {ITEM_BANK.length} ข้อเท่านั้น ไม่เติมคำตอบแทน</li>
            <li>ไม่บังคับให้ผลรวม 8 แกนเท่ากับ 100</li>
            <li>ไม่มี threshold ผ่าน/ตก · ไม่เรียกผู้ที่ดัชนีสูงสุดว่าเก่งที่สุด</li>
            <li>บันทึก scoringVersion, assessmentVersion และ roleProfileVersion คู่กับผลทุกครั้ง</li>
            <li>AI ใช้เพื่อถามและสรุปความต้องการของตำแหน่ง และอธิบายผลที่คำนวณแล้ว ไม่มีสิทธิ์สร้างหรือแก้คะแนน</li>
          </ul>
        </Card>
        <Card>
          <h2 className="font-semibold mb-2">แบบประเมิน</h2>
          <p>{ITEM_BANK.length} ข้อ (8 ข้อต่อแกน) มาตรวัด 5 ระดับ: {([1, 2, 3, 4, 5] as const).map((v) => `${v} ${LIKERT_LABELS[v]}`).join(" · ")}</p>
          <p className="text-muted mt-1">กรอบคำตอบ: {RESPONSE_FRAME}</p>
          <details className="mt-2">
            <summary className="cursor-pointer">ดูข้อคำถามและ scoring key (เฉพาะองค์กร ไม่แสดงให้ผู้สมัคร)</summary>
            <table className="w-full text-xs mt-2">
              <thead className="text-left"><tr><th className="py-1 pr-2">id</th><th className="py-1 pr-2">แกน</th><th className="py-1 pr-2">ข้อความ</th><th className="py-1 pr-2">กลับคะแนน</th><th className="py-1">คู่ตรวจความสอดคล้อง</th></tr></thead>
              <tbody className="divide-y divide-border">
                {ITEM_BANK.map((it) => (
                  <tr key={it.id}><td className="py-1 pr-2">{it.id}</td><td className="py-1 pr-2">{it.scale}</td><td className="py-1 pr-2">{it.text}</td><td className="py-1 pr-2">{it.reverseScored ? "ใช่" : "-"}</td><td className="py-1">{it.pairGroup ?? "-"}</td></tr>
                ))}
              </tbody>
            </table>
          </details>
        </Card>
        <Card>
          <h2 className="font-semibold mb-2">คุณภาพการตอบ</h2>
          <p className="text-muted">แสดงแยกจากดัชนี: ทำครบหรือไม่, ระยะเวลา, ช่วงที่เลือกค่าเดิมติดกัน, ความต่างของคู่ข้อที่กำหนด ใช้เป็นข้อสังเกตสำหรับการพูดคุยเท่านั้น ไม่สรุปว่าผู้สมัครโกหก และไม่แปลงเป็นเปอร์เซ็นต์ความเชื่อมั่นทางสถิติ</p>
        </Card>
      </div>
    </>
  );
}

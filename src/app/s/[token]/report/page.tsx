import Link from "next/link";
import { getCandidateReportData } from "@/lib/services/candidateSessions";
import { ApiError } from "@/lib/util/http";
import { Alert, Card, Disclaimer } from "@/components/ui";
import { RadarChart } from "@/components/RadarChart";
import { ScoreTable } from "@/components/ScoreTable";
import { getAIStatus } from "@/lib/ai";
import { formatDateTh } from "@/lib/util/format";
import { CandidateAiReport } from "./CandidateAiReport";
import { DeletionRequest } from "./DeletionRequest";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "ผลของคุณ" };

export default async function CandidateReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let data;
  try {
    data = await getCandidateReportData(token);
  } catch (e) {
    const err = e instanceof ApiError ? e : null;
    if (err?.code === "not_completed") {
      return (
        <Alert tone="info" title="ยังทำไม่เสร็จ">
          คุณยังส่งแบบประเมินไม่ครบ <Link href={`/s/${token}`} className="underline">กลับไปทำต่อ</Link>
        </Alert>
      );
    }
    return <Alert tone="danger" title="ไม่พบผลลัพธ์">{err?.message ?? "ลิงก์ไม่ถูกต้อง"}</Alert>;
  }
  const ai = getAIStatus();
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-muted">{data.orgName} · {data.roleTitle} · รหัส {data.candidateCode}</p>
          <h1 className="text-2xl font-semibold tracking-tight">ผลพฤติกรรมการทำงานที่คุณรายงาน</h1>
          <p className="text-xs text-muted">ส่งเมื่อ {formatDateTh(data.submittedAt)} · {data.assessmentVersionCode} · {data.scoringVersion}</p>
        </div>
        <PrintButton />
      </div>
      <Alert tone="info">
        คะแนนด้านล่างคือ <strong>คะแนนตามสเกลของต้นแบบ (0–100)</strong> จากคำตอบที่คุณรายงานด้วยตนเอง คะแนนสูงไม่ได้แปลว่าดีกว่า และคะแนนต่ำไม่ได้แปลว่าขาดความสามารถ หน้านี้ไม่แสดงเป้าหมายขององค์กรหรือการเปรียบเทียบกับผู้อื่น
      </Alert>
      <Card>
        <RadarChart series={[{ name: "พฤติกรรมที่คุณรายงาน", values: data.scaleScores }]} height={300} title="โปรไฟล์ที่คุณรายงาน" />
        <ScoreTable scores={data.scaleScores} showTendency />
      </Card>
      <CandidateAiReport token={token} initial={data.aiReport} isDemo={ai.isDemo} />
      <Card className="text-sm space-y-2">
        <h2 className="font-semibold">ข้อมูลของคุณ</h2>
        <p className="text-muted">เก็บลิงก์หน้านี้ไว้เพื่อกลับมาดูผล หากต้องการให้ลบข้อมูล กดปุ่มด้านล่าง องค์กรจะเห็นคำขอและดำเนินการ</p>
        <DeletionRequest token={token} />
      </Card>
      <Disclaimer />
    </div>
  );
}

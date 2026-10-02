"use client";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Spinner } from "@/components/ui";
import type { OrganizationReport } from "@/lib/ai/schemas";
import { AXIS_DEFINITIONS } from "@/lib/model/axes";

interface Report { provider: string; model: string; content: unknown; createdAt: string }

export function OrgAiReport({ sessionId, initial, isDemo }: { sessionId: string; initial: Report | null; isDemo: boolean }) {
  const [report, setReport] = useState<Report | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(force = false) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/report${force ? "?force=1" : ""}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error?.message ?? "สร้างคำอธิบายไม่สำเร็จ");
      setReport(json.data.report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "สร้างคำอธิบายไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (initial) return;
    const t = setTimeout(() => void generate(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const c = report?.content as OrganizationReport | undefined;
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">คำอธิบายสำหรับองค์กร</h2>
        {report && <Badge tone={report.provider === "demo" ? "warning" : "info"}>{report.provider === "demo" ? "Demo: สร้างจากแม่แบบ ไม่ใช่ AI จริง" : `สร้างโดย AI (${report.model})`}</Badge>}
        <Button type="button" size="sm" variant="ghost" className="ml-auto no-print" onClick={() => generate(true)} disabled={busy}>สร้างใหม่</Button>
      </div>
      <Alert tone="warning">คำอธิบายนี้{report?.provider === "demo" ? "มาจากแม่แบบใน Demo mode" : "สร้างโดย AI"} จากคะแนนที่คำนวณด้วยโค้ด องค์กรควรทบทวนก่อนใช้ และต้องตรวจทักษะ/ประสบการณ์แยกต่างหาก ไม่ใช้เพื่อตัดสินรับ/ปฏิเสธโดยอัตโนมัติ</Alert>
      {busy && <Spinner label={isDemo ? "กำลังเตรียมคำอธิบาย (demo)…" : "AI กำลังเขียนคำอธิบาย…"} />}
      {error && (
        <Alert tone="danger">
          {error} <Button type="button" size="sm" variant="secondary" className="ml-2" onClick={() => generate()} disabled={busy}>ลองใหม่</Button>
        </Alert>
      )}
      {c && (
        <div className="space-y-4 text-sm">
          <p>{c.summary}</p>
          <List title="จุดสอดคล้องกับงาน" items={c.alignmentPoints} />
          <List title="ความต่างที่ควรถามเพิ่ม" items={c.differencesToExplore} />
          <section>
            <h3 className="font-medium mb-1">คำถามสัมภาษณ์ที่โยงกับงานจริง</h3>
            <ol className="list-decimal pl-5 space-y-2">
              {c.interviewQuestions.map((q, i) => (
                <li key={i}>
                  <p>{q.question}</p>
                  <p className="text-xs text-muted">แกน {q.linkedAxis} ({AXIS_DEFINITIONS[q.linkedAxis]?.nameTh}) · {q.whyThis}</p>
                </li>
              ))}
            </ol>
          </section>
          <List title="ตัวอย่าง work sample / สถานการณ์เพื่อตรวจทักษะแยก" items={c.workSampleIdeas} />
          <List title="แนวทางที่หัวหน้าควรปรับ" items={c.managerAdjustments} />
          <List title="แนวทางที่ผู้สมัครอาจฝึกหรือปรับ" items={c.candidateAdjustments} />
          <section>
            <h3 className="font-medium mb-1">แผน onboarding 30 วัน</h3>
            <div className="grid sm:grid-cols-3 gap-2">
              {c.onboardingPlan30Days.map((p, i) => (
                <div key={i} className="border border-border rounded-[var(--radius)] p-3">
                  <p className="font-medium text-xs text-muted">{p.period}</p>
                  <ul className="list-disc pl-4 mt-1 space-y-1">
                    {p.focus.map((f, j) => (
                      <li key={j}>{f}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
          <List title="ข้อควรระวัง" items={c.cautions} muted />
        </div>
      )}
    </Card>
  );
}

function List({ title, items, muted }: { title: string; items: string[]; muted?: boolean }) {
  if (!items?.length) return null;
  return (
    <section>
      <h3 className="font-medium mb-1">{title}</h3>
      <ul className={`list-disc pl-5 space-y-1 ${muted ? "text-muted" : ""}`}>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </section>
  );
}

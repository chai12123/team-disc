"use client";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Spinner } from "@/components/ui";
import type { CandidateReport } from "@/lib/ai/schemas";

interface Report { provider: string; model: string; content: unknown; createdAt: string }

export function CandidateAiReport({ token, initial, isDemo }: { token: string; initial: Report | null; isDemo: boolean }) {
  const [report, setReport] = useState<Report | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(force = false) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/candidate/sessions/${token}/report${force ? "?force=1" : ""}`, { method: "POST" });
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

  const c = report?.content as CandidateReport | undefined;
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">คำอธิบายและคำแนะนำพัฒนาตน</h2>
        {report && <Badge tone={report.provider === "demo" ? "warning" : "info"}>{report.provider === "demo" ? "Demo: สร้างจากแม่แบบ ไม่ใช่ AI จริง" : `สร้างโดย AI (${report.model})`}</Badge>}
      </div>
      {busy && <Spinner label={isDemo ? "กำลังเตรียมคำอธิบาย (demo)…" : "AI กำลังเขียนคำอธิบาย…"} />}
      {error && (
        <Alert tone="danger">
          {error} <Button type="button" size="sm" variant="secondary" className="ml-2" onClick={() => generate()} disabled={busy}>ลองใหม่</Button>
        </Alert>
      )}
      {c && (
        <div className="space-y-4 text-sm">
          <p>{c.summary}</p>
          <Section title="แนวโน้มพฤติกรรมจากคำตอบที่รายงาน" items={c.tendencies.map((t) => t.text)} />
          <Section title="จุดแข็งที่อาจใช้ประโยชน์ได้" items={c.possibleStrengths} />
          <Section title="สถานการณ์ที่อาจต้องปรับวิธีทำงาน" items={c.situationsToAdapt} />
          <Section title="คำแนะนำการสื่อสารกับทีม" items={c.communicationTips} />
          <Section title="แนวทางพัฒนาตนเอง" items={c.selfDevelopmentIdeas} />
          <Section title="ข้อจำกัดของข้อมูล" items={c.dataLimitations} muted />
          <p className="text-xs text-muted">คำอธิบายนี้{report?.provider === "demo" ? "สร้างจากแม่แบบใน Demo mode" : "สร้างโดย AI"} จากคะแนนที่คำนวณด้วยโค้ด ใช้ภาษามีเงื่อนไขและควรตรวจสอบกับประสบการณ์จริงของคุณ</p>
        </div>
      )}
    </Card>
  );
}

function Section({ title, items, muted }: { title: string; items: string[]; muted?: boolean }) {
  if (!items || items.length === 0) return null;
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

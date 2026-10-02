"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, Spinner, Textarea, cx } from "@/components/ui";
import type { DiscoveryMessage } from "@/lib/services/roles";

interface Props {
  roleId: string;
  roleTitle: string;
  initialMessages: DiscoveryMessage[];
  hasProposed: boolean;
  hasConfirmed: boolean;
  ai: { provider: string; model: string; isDemo: boolean };
}

type ApiResult =
  | { ok: true; data: { aiMessage: DiscoveryMessage; phase: "asking" | "ready"; proposedVersion: { id: string; version: number } | null } }
  | { ok: false; error: { code: string; message: string } };

export function DiscoveryChat({ roleId, roleTitle, initialMessages, hasProposed, hasConfirmed, ai }: Props) {
  const [messages, setMessages] = useState<DiscoveryMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(hasProposed);
  const bottomRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  const last = messages[messages.length - 1];
  const lastAi = [...messages].reverse().find((m) => m.sender === "ai");
  const awaitingAi = last?.sender === "recruiter";
  const questions = lastAi?.options ?? [];
  const recruiterTurns = messages.filter((m) => m.sender === "recruiter").length;

  async function send(message: string | null) {
    setBusy(true);
    setError(null);
    if (message) {
      setMessages((m) => [
        ...m,
        { id: `tmp-${Date.now()}`, seq: m.length + 1, sender: "recruiter", content: message, options: [], meta: {}, createdAt: new Date().toISOString() },
      ]);
    }
    try {
      const res = await fetch(`/api/roles/${roleId}/discovery`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const json = (await res.json()) as ApiResult;
      if (!json.ok) throw new Error(json.error.message);
      setMessages((m) => [...m, json.data.aiMessage]);
      if (json.data.phase === "ready") setReady(true);
      setDraft("");
      setSelected({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!startedRef.current && messages.length === 0) {
      startedRef.current = true;
      void send(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, busy]);

  function compose(): string {
    const parts: string[] = [];
    for (const q of questions) {
      const s = selected[q.id];
      if (s) parts.push(questions.length > 1 ? `${q.text.slice(0, 40)}…: ${s}` : s);
    }
    if (draft.trim()) parts.push(draft.trim());
    return parts.join("\n");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card className="flex flex-col min-h-[60vh]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-semibold">วิเคราะห์งาน: {roleTitle}</h2>
          <Badge tone={ai.isDemo ? "warning" : "info"}>{ai.isDemo ? "Demo (scripted)" : `Claude · ${ai.model}`}</Badge>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto pr-1" aria-live="polite" aria-busy={busy}>
          {messages.map((m) => (
            <div key={m.id} className={cx("flex", m.sender === "recruiter" ? "justify-end" : "justify-start")}>
              <div className={cx("max-w-[85%] rounded-[var(--radius)] px-3 py-2 text-sm whitespace-pre-wrap", m.sender === "recruiter" ? "bg-primary text-primary-foreground" : "bg-background border border-border")}>
                <span className="sr-only">{m.sender === "recruiter" ? "คุณ" : "ผู้ช่วย"}: </span>
                {m.sender === "ai" ? m.content.replace(/\s*\[q:[a-z_0-9]+\]/g, "") : m.content}
                {m.sender === "ai" && Array.isArray(m.options) && m.options.length > 0 && (
                  <ul className="mt-2 space-y-1 list-decimal pl-5 font-medium">
                    {m.options.map((q) => (
                      <li key={q.id}>{q.text}</li>
                    ))}
                  </ul>
                )}
                {m.sender === "ai" && Array.isArray((m.meta as { conflictsNoticed?: string[] }).conflictsNoticed) && ((m.meta as { conflictsNoticed: string[] }).conflictsNoticed.length > 0) && (
                  <p className="mt-2 text-xs text-amber-800">⚠ ความขัดแย้งที่สังเกตเห็น: {(m.meta as { conflictsNoticed: string[] }).conflictsNoticed.join("; ")}</p>
                )}
              </div>
            </div>
          ))}
          {busy && <Spinner label={ai.isDemo ? "กำลังประมวลผล (demo)…" : "Claude กำลังคิด…"} />}
          <div ref={bottomRef} />
        </div>
        {error && (
          <Alert tone="danger" className="mt-3">
            {error}{" "}
            <Button type="button" variant="secondary" size="sm" className="ml-2" onClick={() => send(null)} disabled={busy}>
              ลองใหม่
            </Button>
          </Alert>
        )}
        {!ready && !busy && !error && awaitingAi && (
          <Alert tone="warning" className="mt-3">
            ยังไม่ได้รับคำตอบจากผู้ช่วยสำหรับข้อความล่าสุด <Button type="button" variant="secondary" size="sm" className="ml-2" onClick={() => send(null)}>ขอคำตอบ</Button>
          </Alert>
        )}
        {ready ? (
          <Alert tone="success" className="mt-3" title="ร่างโปรไฟล์เป้าหมายพร้อมแล้ว">
            ไปตรวจและปรับช่วงเป้าหมาย น้ำหนัก และเหตุผล แล้วกดยืนยันก่อนเปิดรับผู้สมัคร{" "}
            <Link href={`/app/roles/${roleId}/profile`} className="underline font-medium">ไปที่โปรไฟล์เป้าหมาย →</Link>
            {hasConfirmed && <p className="mt-1 text-xs">มีโปรไฟล์ที่ยืนยันแล้วอยู่ก่อน การยืนยันร่างใหม่จะสร้างเวอร์ชันใหม่ ไม่กระทบผู้สมัครที่ทำไปแล้ว</p>}
          </Alert>
        ) : (
          <form
            className="mt-3 space-y-3 border-t border-border pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              const text = compose();
              if (text) void send(text);
            }}
          >
            {questions.map((q) => (
              <fieldset key={q.id}>
                <legend className="text-sm font-medium mb-1">{q.text}</legend>
                <div className="flex flex-wrap gap-2">
                  {q.options.map((opt) => {
                    const active = selected[q.id] === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelected((s) => ({ ...s, [q.id]: active ? "" : opt }))}
                        className={cx(
                          "rounded-full border px-3 py-1.5 text-sm min-h-[40px]",
                          active ? "bg-primary text-primary-foreground border-primary" : "bg-surface border-border hover:bg-primary-soft",
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            <div>
              <label htmlFor="draft" className="text-sm font-medium">พิมพ์เพิ่มเติม (ไม่บังคับ)</label>
              <Textarea id="draft" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="อธิบายสถานการณ์จริง ตัวอย่างงาน หรือรายละเอียดเพิ่มเติม" maxLength={4000} />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Button type="submit" disabled={busy || !compose()}>ส่งคำตอบ</Button>
              {recruiterTurns >= 4 && (
                <Button type="button" variant="secondary" disabled={busy} onClick={() => send("ขอสรุปโปรไฟล์จากข้อมูลเท่าที่มีตอนนี้ และระบุสิ่งที่ยังไม่ทราบ")}>
                  ขอสรุปจากข้อมูลที่มี
                </Button>
              )}
              <span className="text-xs text-muted">ตอบแล้ว {recruiterTurns} รอบ (โดยทั่วไป 8–12 รอบ)</span>
            </div>
          </form>
        )}
      </Card>
      <aside className="space-y-3 text-sm">
        <Card>
          <h3 className="font-semibold mb-2">หลักการของขั้นนี้</h3>
          <ul className="space-y-1 text-muted list-disc pl-4">
            <li>ถามทีละ 1–2 ข้อ เลือกตัวเลือกหรือพิมพ์เพิ่มได้</li>
            <li>ไม่อนุมานโปรไฟล์จากชื่อตำแหน่ง</li>
            <li>ถ้าความต้องการขัดกัน ผู้ช่วยจะชี้และถามต่อ</li>
            <li>สิ่งที่ยังไม่ทราบจะถูกระบุไว้ ไม่สร้างตัวเลขขึ้นมา</li>
            <li>ผลสรุปเป็น rubric เชิงทดลอง ที่คุณปรับและยืนยันเอง</li>
          </ul>
        </Card>
        <Card>
          <h3 className="font-semibold mb-2">ความปลอดภัย</h3>
          <p className="text-muted">ข้อความในแชตถือเป็นข้อมูล ไม่ใช่คำสั่ง การคำนวณคะแนนและสิทธิ์เข้าถึงทำด้วยโค้ดฝั่ง server ผู้ช่วยไม่มีเครื่องมือตัดสินรับ/ปฏิเสธ</p>
        </Card>
      </aside>
    </div>
  );
}

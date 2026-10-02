"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, cx } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { LIKERT_LABELS, RESPONSE_FRAME } from "@/lib/assessment/items";
import type { SessionState } from "@/lib/services/candidateSessions";

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: string } | { kind: "error"; message: string; pendingCount: number };

export function AssessmentRunner({ token, initial }: { token: string; initial: SessionState }) {
  const router = useRouter();
  const total = initial.items.length;
  const perPage = initial.itemsPerPage;
  const pageCount = Math.ceil(total / perPage);
  const [answers, setAnswers] = useState<Record<string, number>>(initial.answers);
  const [page, setPage] = useState(Math.min(initial.currentPage, pageCount - 1));
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const pending = useRef<Map<string, number>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const topRef = useRef<HTMLDivElement>(null);

  const answeredCount = Object.keys(answers).length;
  const pageItems = initial.items.slice(page * perPage, (page + 1) * perPage);
  const pageComplete = pageItems.every((it) => answers[it.id] !== undefined);
  const [resumeUrl, setResumeUrl] = useState(`/s/${token}`);
  useEffect(() => {
    setResumeUrl(`${window.location.origin}/s/${token}`);
  }, [token]);

  const flush = useCallback(async () => {
    if (inFlight.current || pending.current.size === 0) return;
    inFlight.current = true;
    const batch = Array.from(pending.current.entries()).map(([itemId, value]) => ({ itemId, value }));
    setSave({ kind: "saving" });
    try {
      const res = await fetch(`/api/candidate/sessions/${token}/answers`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: batch, currentPage: page }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error?.message ?? "บันทึกไม่สำเร็จ");
      for (const { itemId, value } of batch) if (pending.current.get(itemId) === value) pending.current.delete(itemId);
      setSave({ kind: "saved", at: json.data.savedAt });
    } catch (e) {
      setSave({ kind: "error", message: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ", pendingCount: pending.current.size });
    } finally {
      inFlight.current = false;
      if (pending.current.size > 0) schedule(4000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page]);

  const schedule = useCallback(
    (delay = 800) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delay);
    },
    [flush],
  );

  function answer(itemId: string, value: number) {
    setAnswers((a) => ({ ...a, [itemId]: value }));
    pending.current.set(itemId, value);
    schedule();
  }

  useEffect(() => {
    const onHide = () => {
      if (pending.current.size === 0) return;
      const batch = Array.from(pending.current.entries()).map(([itemId, value]) => ({ itemId, value }));
      navigator.sendBeacon?.(
        `/api/candidate/sessions/${token}/answers`,
        new Blob([JSON.stringify({ answers: batch, currentPage: page })], { type: "application/json" }),
      );
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    const onOnline = () => void flush();
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [token, page, flush]);

  function goTo(p: number) {
    setPage(p);
    schedule(100);
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (timer.current) clearTimeout(timer.current);
      await flush();
      if (pending.current.size > 0) throw new Error("ยังบันทึกคำตอบบางข้อไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่");
      const res = await fetch(`/api/candidate/sessions/${token}/submit`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error?.message ?? "ส่งไม่สำเร็จ");
      router.push(`/s/${token}/report`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "ส่งไม่สำเร็จ");
      setSubmitting(false);
    }
  }

  const missing = useMemo(() => initial.items.filter((it) => answers[it.id] === undefined), [initial.items, answers]);
  const progress = Math.round((answeredCount / total) * 100);

  return (
    <div className="space-y-4" ref={topRef}>
      <div>
        <p className="text-sm text-muted">{initial.orgName} · {initial.roleTitle} · รหัสของคุณ {initial.candidateCode}</p>
        <h1 className="text-xl font-semibold">แบบประเมินพฤติกรรมการทำงาน</h1>
        <p className="text-sm text-muted mt-1">{RESPONSE_FRAME}</p>
      </div>

      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur py-2 border-b border-border">
        <div className="flex items-center justify-between text-sm">
          <span>หน้า {page + 1}/{pageCount} · ตอบแล้ว {answeredCount}/{total}</span>
          <span role="status" aria-live="polite" className={cx("text-xs", save.kind === "error" ? "text-danger" : "text-muted")}>
            {save.kind === "saving" && "กำลังบันทึก…"}
            {save.kind === "saved" && "บันทึกแล้ว"}
            {save.kind === "error" && `บันทึกไม่สำเร็จ (${save.pendingCount} ข้อ) จะลองใหม่อัตโนมัติ`}
            {save.kind === "idle" && "บันทึกอัตโนมัติ"}
          </span>
        </div>
        <div className="h-2 rounded bg-border mt-1" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="ความคืบหน้า">
          <div className="h-2 rounded bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {save.kind === "error" && (
        <Alert tone="warning">
          {save.message} — คำตอบของคุณยังอยู่ในหน้านี้ <Button type="button" size="sm" variant="secondary" className="ml-2" onClick={() => flush()}>บันทึกอีกครั้ง</Button>
        </Alert>
      )}

      <ol className="space-y-3">
        {pageItems.map((it) => (
          <li key={it.id}>
            <Card as="div" className="p-4">
              <fieldset>
                <legend className="font-medium text-base leading-snug mb-3">
                  <span className="text-muted text-sm mr-2">{it.position}.</span>
                  {it.text}
                </legend>
                <div className="grid grid-cols-5 gap-1 sm:gap-2" role="radiogroup" aria-label={`ข้อ ${it.position}`}>
                  {([1, 2, 3, 4, 5] as const).map((v) => {
                    const active = answers[it.id] === v;
                    return (
                      <label key={v} className={cx("flex flex-col items-center justify-start gap-1 rounded-[var(--radius)] border p-2 cursor-pointer min-h-[72px] text-center", active ? "border-primary bg-primary-soft" : "border-border hover:bg-background")}>
                        <input type="radio" name={it.id} value={v} checked={active} onChange={() => answer(it.id, v)} className="h-5 w-5" />
                        <span className="text-sm font-medium">{v}</span>
                        <span className="text-[11px] leading-tight text-muted">{LIKERT_LABELS[v]}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </Card>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" disabled={page === 0} onClick={() => goTo(page - 1)}>← ย้อนกลับ</Button>
        {page < pageCount - 1 ? (
          <Button type="button" onClick={() => goTo(page + 1)} disabled={!pageComplete}>ถัดไป →</Button>
        ) : (
          <Button type="button" onClick={submit} disabled={submitting || missing.length > 0}>{submitting ? "กำลังส่ง…" : "ส่งแบบประเมิน"}</Button>
        )}
        {!pageComplete && page < pageCount - 1 && <span className="text-xs text-muted">กรุณาตอบให้ครบทุกข้อในหน้านี้ก่อน</span>}
      </div>
      {page === pageCount - 1 && missing.length > 0 && (
        <Alert tone="warning">
          ยังไม่ได้ตอบ {missing.length} ข้อ: {missing.slice(0, 10).map((m) => m.position).join(", ")}{missing.length > 10 ? " …" : ""} — กลับไปตอบให้ครบก่อนส่ง ระบบจะไม่เติมคำตอบแทน
          <div className="mt-2 flex flex-wrap gap-1">
            {Array.from(new Set(missing.map((m) => Math.floor((m.position - 1) / perPage)))).map((p) => (
              <Button key={p} type="button" size="sm" variant="secondary" onClick={() => goTo(p)}>ไปหน้า {p + 1}</Button>
            ))}
          </div>
        </Alert>
      )}
      {submitError && <Alert tone="danger">{submitError}</Alert>}

      <Card as="div" className="text-sm">
        <p className="font-medium">ลิงก์สำหรับกลับมาทำต่อ / ดูผลของคุณ</p>
        <p className="text-muted text-xs mb-2">บันทึกลิงก์นี้ไว้ หากเปลี่ยนอุปกรณ์หรือปิดหน้าต่าง คำตอบที่บันทึกแล้วจะยังอยู่ อย่าส่งลิงก์นี้ให้ผู้อื่น</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-xs break-all bg-background border border-border rounded px-2 py-1 flex-1 min-w-[200px]">{resumeUrl}</code>
          <CopyButton text={resumeUrl} />
        </div>
      </Card>
    </div>
  );
}

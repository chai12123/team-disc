"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Textarea } from "@/components/ui";
import type { NoteRow } from "@/lib/services/reports";
import { formatDateTh } from "@/lib/util/format";

export function NotesPanel({ sessionId, initial, canDelete, roleId }: { sessionId: string; initial: NoteRow[]; canDelete: boolean; roleId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState(initial);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/notes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message);
      setNotes(json.data.notes);
      setBody("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm("ลบข้อมูลผู้สมัครรายนี้ทั้งหมด (คำตอบ คะแนน รายงาน) การลบย้อนกลับไม่ได้")) return;
    const res = await fetch(`/api/sessions/${sessionId}/delete`, { method: "POST" });
    if (res.ok) router.push(`/app/roles/${roleId}/candidates`);
  }

  return (
    <Card className="no-print">
      <h2 className="font-semibold mb-2">บันทึกของผู้รับสมัคร</h2>
      <ul className="space-y-2 text-sm mb-3">
        {notes.length === 0 && <li className="text-muted">ยังไม่มีบันทึก</li>}
        {notes.map((n) => (
          <li key={n.id} className="border border-border rounded-[var(--radius)] p-2">
            <p className="whitespace-pre-wrap">{n.body}</p>
            <p className="text-xs text-muted mt-1">{n.authorName ?? "ไม่ระบุ"} · {formatDateTh(n.createdAt)}</p>
          </li>
        ))}
      </ul>
      <div className="space-y-2">
        <label htmlFor="note" className="text-sm font-medium">เพิ่มบันทึก (เช่น สิ่งที่พบในสัมภาษณ์ หรือผล work sample)</label>
        <Textarea id="note" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex gap-2">
          <Button type="button" onClick={add} disabled={busy || !body.trim()}>บันทึก</Button>
          {canDelete && <Button type="button" variant="danger" className="ml-auto" onClick={del}>ลบข้อมูลผู้สมัครรายนี้</Button>}
        </div>
      </div>
    </Card>
  );
}

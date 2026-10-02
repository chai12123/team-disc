"use client";
import { useState } from "react";
import { Alert, Button, Input } from "@/components/ui";

export function DeletionRequest({ token }: { token: string }) {
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  if (state === "done") return <Alert tone="success">ส่งคำขอลบข้อมูลแล้ว องค์กรจะดำเนินการและข้อมูลจะถูกลบออกจากระบบ</Alert>;
  return (
    <form
      className="flex flex-wrap gap-2 items-end no-print"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("busy");
        const res = await fetch(`/api/candidate/sessions/${token}/deletion`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason }) });
        setState(res.ok ? "done" : "error");
      }}
    >
      <div className="flex-1 min-w-[200px]">
        <label htmlFor="reason" className="text-xs text-muted">เหตุผล (ไม่บังคับ)</label>
        <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </div>
      <Button type="submit" variant="danger" size="sm" disabled={state === "busy"}>ขอลบข้อมูลของฉัน</Button>
      {state === "error" && <Alert tone="danger">ส่งคำขอไม่สำเร็จ ลองใหม่</Alert>}
    </form>
  );
}

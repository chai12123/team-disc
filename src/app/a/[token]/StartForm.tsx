"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input, Label } from "@/components/ui";

export function StartForm({ token }: { token: string }) {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/candidate/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, consent, displayName, email }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "เริ่มไม่สำเร็จ");
      router.push(json.data.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เริ่มไม่สำเร็จ");
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-3 border-t border-border pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (consent) void start();
      }}
    >
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="displayName" hint="ไม่บังคับ — องค์กรใช้เพื่อระบุตัวคุณ">ชื่อที่แสดง</Label>
          <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={120} autoComplete="name" />
        </div>
        <div>
          <Label htmlFor="email" hint="ไม่บังคับ — ใช้ติดต่อเท่านั้น">อีเมล</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} autoComplete="email" />
        </div>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 h-5 w-5" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
        <span>ฉันได้อ่านจุดประสงค์ ผู้เข้าถึงผล ข้อจำกัด และวิธีขอลบข้อมูลแล้ว และยินยอมให้เก็บคำตอบเพื่อใช้ตามที่ระบุ</span>
      </label>
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" size="lg" className="w-full" disabled={!consent || busy}>{busy ? "กำลังเริ่ม…" : "เริ่มทำแบบประเมิน"}</Button>
    </form>
  );
}

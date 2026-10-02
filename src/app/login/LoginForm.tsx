"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input, Label } from "@/components/ui";

interface Props {
  mode: "dev" | "supabase";
  supabaseUrl: string;
  supabaseAnonKey: string;
  demoAccounts: { email: string; displayName: string | null; orgName: string }[];
}

export function LoginForm({ mode, supabaseUrl, supabaseAnonKey, demoAccounts }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [signUp, setSignUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function devLogin(targetEmail: string, name?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: targetEmail, displayName: name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "เข้าสู่ระบบไม่สำเร็จ");
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function supabaseLogin() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const { createSupabaseBrowserClient } = await import("@/lib/auth/supabaseBrowser");
      const supabase = createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey);
      if (signUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName }, emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        setInfo("สมัครแล้ว หากโปรเจกต์เปิดการยืนยันอีเมล กรุณาตรวจอีเมลก่อนเข้าสู่ระบบ");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "dev") {
    return (
      <div className="space-y-4">
        <h2 className="font-semibold">เข้าสู่ระบบ (Dev login)</h2>
        {demoAccounts.length > 0 && (
          <div>
            <p className="text-sm text-muted mb-2">บัญชีทดลองจาก demo data:</p>
            <ul className="space-y-2">
              {demoAccounts.map((a) => (
                <li key={a.email}>
                  <Button type="button" variant="secondary" className="w-full justify-between" disabled={busy} onClick={() => devLogin(a.email)}>
                    <span>{a.displayName ?? a.email}</span>
                    <span className="text-xs text-muted">{a.orgName}</span>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <form
          className="space-y-3 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            devLogin(email, displayName || undefined);
          }}
        >
          <p className="text-sm text-muted">หรือสร้าง/เข้าใช้บัญชีด้วยอีเมลใดก็ได้ (ข้อมูลเก็บในฐานข้อมูลของคุณ)</p>
          <div>
            <Label htmlFor="email">อีเมล</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="name">ชื่อที่แสดง (ไม่บังคับ)</Label>
            <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        supabaseLogin();
      }}
    >
      <h2 className="font-semibold">{signUp ? "สมัครบัญชีองค์กร" : "เข้าสู่ระบบองค์กร"}</h2>
      {signUp && (
        <div>
          <Label htmlFor="name">ชื่อที่แสดง</Label>
          <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
      )}
      <div>
        <Label htmlFor="email">อีเมล</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div>
        <Label htmlFor="password">รหัสผ่าน</Label>
        <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={signUp ? "new-password" : "current-password"} />
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {info && <Alert tone="success">{info}</Alert>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "กำลังดำเนินการ…" : signUp ? "สมัคร" : "เข้าสู่ระบบ"}
      </Button>
      <button type="button" className="text-sm text-primary underline" onClick={() => setSignUp((v) => !v)}>
        {signUp ? "มีบัญชีแล้ว? เข้าสู่ระบบ" : "ยังไม่มีบัญชี? สมัครใหม่"}
      </button>
    </form>
  );
}

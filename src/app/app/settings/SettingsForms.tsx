"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Input, Label, Select } from "@/components/ui";

export function SettingsForms({ org, isAdmin }: { org: { id: string; name: string; dataRetentionDays: number }; isAdmin: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(org.name);
  const [days, setDays] = useState(org.dataRetentionDays);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"recruiter" | "org_admin">("recruiter");
  const [msg, setMsg] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error?.message ?? "ไม่สำเร็จ");
    return json.data;
  }

  return (
    <Card className="space-y-4">
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await post("/api/org", { name, dataRetentionDays: days });
            setMsg({ tone: "success", text: "บันทึกแล้ว" });
            router.refresh();
          } catch (err) {
            setMsg({ tone: "danger", text: err instanceof Error ? err.message : "ไม่สำเร็จ" });
          }
        }}
      >
        <h2 className="font-semibold">ข้อมูลองค์กร</h2>
        <div>
          <Label htmlFor="orgName">ชื่อองค์กร</Label>
          <Input id="orgName" value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} />
        </div>
        <div>
          <Label htmlFor="days" hint="30–3650 วัน ข้อมูลผู้สมัครที่เก่ากว่านี้จะถูกลบเมื่อกด “ลบข้อมูลที่เกินกำหนด”">ระยะเวลาเก็บข้อมูลผู้สมัคร (วัน)</Label>
          <Input id="days" type="number" min={30} max={3650} value={days} onChange={(e) => setDays(Number(e.target.value))} disabled={!isAdmin} />
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button type="submit">บันทึก</Button>
            <Button
              type="button"
              variant="danger"
              onClick={async () => {
                if (!confirm("ลบข้อมูลผู้สมัครทั้งหมดที่เก่ากว่าระยะเวลาเก็บ? ย้อนกลับไม่ได้")) return;
                try {
                  const d = await post("/api/org/purge", {});
                  setMsg({ tone: "success", text: `ลบข้อมูลผู้สมัครที่เกินกำหนด ${d.deleted} ราย` });
                  router.refresh();
                } catch (err) {
                  setMsg({ tone: "danger", text: err instanceof Error ? err.message : "ไม่สำเร็จ" });
                }
              }}
            >
              ลบข้อมูลที่เกินกำหนด
            </Button>
          </div>
        )}
      </form>
      {isAdmin && (
        <form
          className="space-y-3 border-t border-border pt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await post("/api/org/members", { email, role });
              setMsg({ tone: "success", text: "เพิ่มสมาชิกแล้ว" });
              setEmail("");
              router.refresh();
            } catch (err) {
              setMsg({ tone: "danger", text: err instanceof Error ? err.message : "ไม่สำเร็จ" });
            }
          }}
        >
          <h2 className="font-semibold">เพิ่มสมาชิก</h2>
          <p className="text-xs text-muted">ผู้ใช้ต้องเคยเข้าสู่ระบบอย่างน้อยหนึ่งครั้ง (ระบบไม่ส่งอีเมลเชิญใน MVP)</p>
          <div className="grid sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
            <div>
              <Label htmlFor="memberEmail">อีเมล</Label>
              <Input id="memberEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="memberRole">บทบาท</Label>
              <Select id="memberRole" value={role} onChange={(e) => setRole(e.target.value as "recruiter" | "org_admin")}>
                <option value="recruiter">Recruiter</option>
                <option value="org_admin">ผู้ดูแลองค์กร</option>
              </Select>
            </div>
            <Button type="submit">เพิ่ม</Button>
          </div>
        </form>
      )}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </Card>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser, getOrgContext } from "@/lib/auth/server";
import { DemoBanner } from "@/components/DemoBanner";
import { Button, Select } from "@/components/ui";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ctx = await getOrgContext();
  if (!ctx) redirect("/onboarding");
  const nav = [
    { href: "/app", label: "แดชบอร์ด" },
    { href: "/app/roles", label: "ตำแหน่งงาน" },
    { href: "/app/methodology", label: "สูตรคะแนน" },
    { href: "/app/settings", label: "ตั้งค่า" },
  ];
  return (
    <>
      <DemoBanner />
      <header className="no-print bg-surface border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <Link href="/app" className="font-semibold text-lg tracking-tight">TeamFit</Link>
          <nav aria-label="เมนูหลัก" className="flex gap-1 flex-wrap">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="px-3 py-2 rounded-[var(--radius)] text-sm hover:bg-primary-soft">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            {ctx.memberships.length > 1 ? (
              <form action="/api/auth/switch-org" method="post" className="flex items-center gap-2">
                <label htmlFor="orgId" className="sr-only">เลือกองค์กร</label>
                <Select id="orgId" name="orgId" defaultValue={ctx.org.id} className="min-h-[36px] py-1 text-sm">
                  {ctx.memberships.map((m) => (
                    <option key={m.orgId} value={m.orgId}>{m.orgName}</option>
                  ))}
                </Select>
                <Button type="submit" variant="ghost" size="sm">สลับ</Button>
              </form>
            ) : (
              <span className="text-muted">{ctx.org.name}</span>
            )}
            <span className="hidden sm:inline text-muted">· {user.displayName ?? user.email}</span>
            <form action="/api/auth/logout" method="post">
              <Button type="submit" variant="ghost" size="sm">ออกจากระบบ</Button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
      <footer className="no-print max-w-6xl w-full mx-auto px-4 py-6 text-xs text-muted">
        TeamFit (ต้นแบบ) · บทบาทของคุณ: {ctx.membership.role === "org_admin" ? "ผู้ดูแลองค์กร" : "Recruiter"} · ระบบนี้ไม่ตัดสินรับหรือปฏิเสธผู้สมัคร
      </footer>
    </>
  );
}

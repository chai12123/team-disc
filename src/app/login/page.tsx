import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { authMode, env } from "@/lib/env";
import { getSql } from "@/lib/db/client";
import { DemoBanner } from "@/components/DemoBanner";
import { Card, Disclaimer } from "@/components/ui";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "เข้าสู่ระบบ" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");
  const mode = authMode();
  let demoAccounts: { email: string; displayName: string | null; orgName: string }[] = [];
  if (mode === "dev") {
    const sql = getSql();
    demoAccounts = await sql<{ email: string; displayName: string | null; orgName: string }[]>`
      select u.email, u.display_name, o.name as org_name
      from users u join memberships m on m.user_id = u.id join organizations o on o.id = m.org_id
      where o.is_demo = true order by o.created_at, m.created_at limit 6
    `;
  }
  return (
    <>
      <DemoBanner />
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight">TeamFit</h1>
            <p className="text-sm text-muted mt-1">เครื่องมือช่วยทำความเข้าใจพฤติกรรมการทำงานร่วมกัน (ต้นแบบ)</p>
          </div>
          <Card>
            <LoginForm mode={mode} supabaseUrl={env.supabaseUrl} supabaseAnonKey={env.supabaseAnonKey} demoAccounts={demoAccounts} />
          </Card>
          <Disclaimer />
        </div>
      </main>
    </>
  );
}

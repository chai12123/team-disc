import { redirect } from "next/navigation";
import { getCurrentUser, getOrgContext } from "@/lib/auth/server";
import { DemoBanner } from "@/components/DemoBanner";
import { Button, Card, Input, Label } from "@/components/ui";

export const metadata = { title: "สร้างองค์กร" };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ctx = await getOrgContext();
  if (ctx) redirect("/app");
  return (
    <>
      <DemoBanner />
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <h1 className="text-xl font-semibold">สร้างองค์กรของคุณ</h1>
          <p className="text-sm text-muted mt-1 mb-4">คุณจะเป็นผู้ดูแลองค์กร (Organization Admin) และเชิญ Recruiter เพิ่มได้ภายหลัง</p>
          <form action="/api/onboarding" method="post" className="space-y-3">
            <div>
              <Label htmlFor="name">ชื่อองค์กร</Label>
              <Input id="name" name="name" required maxLength={200} />
            </div>
            <Button type="submit" className="w-full">สร้างองค์กร</Button>
          </form>
        </Card>
      </main>
    </>
  );
}

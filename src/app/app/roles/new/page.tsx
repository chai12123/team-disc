import { redirect } from "next/navigation";
import { requireOrgContext } from "@/lib/auth/server";
import { createRole, CreateRoleSchema } from "@/lib/services/roles";
import { Button, Card, Input, Label, PageHeader, Alert } from "@/components/ui";

export const metadata = { title: "สร้างตำแหน่งงาน" };

export default function NewRolePage() {
  async function action(formData: FormData) {
    "use server";
    const ctx = await requireOrgContext();
    const input = CreateRoleSchema.parse({ title: formData.get("title"), level: formData.get("level") ?? "" });
    const role = await createRole(ctx, input);
    redirect(`/app/roles/${role.id}/discovery`);
  }
  return (
    <>
      <PageHeader title="สร้างตำแหน่งงาน" description="ขั้นถัดไปคือคุยกับ AI เพื่อวิเคราะห์งาน ระบบจะไม่สร้างโปรไฟล์จากชื่อตำแหน่งอย่างเดียว" />
      <Card className="max-w-lg">
        <form action={action} className="space-y-4">
          <div>
            <Label htmlFor="title">ชื่อตำแหน่ง</Label>
            <Input id="title" name="title" required maxLength={200} placeholder="เช่น Customer Success Specialist" />
          </div>
          <div>
            <Label htmlFor="level" hint="เช่น Junior, Senior, หัวหน้าทีม">ระดับ (ไม่บังคับ)</Label>
            <Input id="level" name="level" maxLength={100} />
          </div>
          <Alert tone="info">ชื่อตำแหน่งใช้เป็นบริบทเท่านั้น ช่วงเป้าหมาย 8 แกนจะมาจากคำตอบของคุณในขั้นวิเคราะห์งาน</Alert>
          <Button type="submit">สร้างและเริ่มวิเคราะห์งาน</Button>
        </form>
      </Card>
    </>
  );
}

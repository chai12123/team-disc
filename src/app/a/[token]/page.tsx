import { resolveInviteToken } from "@/lib/services/candidateSessions";
import { ApiError } from "@/lib/util/http";
import { Alert, Card } from "@/components/ui";
import { ITEM_COUNT, RESPONSE_FRAME } from "@/lib/assessment/items";
import { getAIStatus } from "@/lib/ai";
import { StartForm } from "./StartForm";

export const metadata = { title: "แบบประเมินพฤติกรรมการทำงาน" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let inv;
  try {
    inv = await resolveInviteToken(token);
  } catch (e) {
    const msg = e instanceof ApiError ? e.message : "ไม่พบลิงก์นี้";
    return <Alert tone="danger" title="เปิดลิงก์ไม่ได้">{msg} กรุณาติดต่อองค์กรที่ส่งลิงก์ให้คุณ</Alert>;
  }
  if (inv.status !== "active") {
    const text = { revoked: "ลิงก์นี้ถูกเพิกถอนแล้ว", expired: "ลิงก์นี้หมดอายุแล้ว", used: "ลิงก์นี้ถูกใช้เริ่มทำแบบประเมินแล้ว หากคุณคือผู้ที่เริ่มไว้ กรุณาใช้ลิงก์สำหรับกลับมาทำต่อที่ได้รับตอนเริ่ม" }[inv.status];
    return <Alert tone="warning" title="ไม่สามารถเริ่มได้">{text} หากต้องการความช่วยเหลือ กรุณาติดต่อ {inv.orgName}</Alert>;
  }
  const ai = getAIStatus();
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted">{inv.orgName}</p>
        <h1 className="text-2xl font-semibold tracking-tight">แบบประเมินพฤติกรรมการทำงาน: {inv.roleTitle}</h1>
      </div>
      <Card className="space-y-4 text-sm">
        <section>
          <h2 className="font-semibold">จุดประสงค์</h2>
          <p className="text-muted">แบบประเมินนี้ช่วยให้คุณและ {inv.orgName} เข้าใจรูปแบบพฤติกรรมการทำงานที่คุณรายงานด้วยตนเอง เพื่อใช้เป็นข้อมูลประกอบการพูดคุยในขั้นสัมภาษณ์และการวางแผนเริ่มงาน ไม่ใช่การสอบ ไม่มีคำตอบถูกหรือผิด และไม่ได้ใช้ตัดสินรับหรือปฏิเสธโดยอัตโนมัติ</p>
        </section>
        <section>
          <h2 className="font-semibold">วิธีตอบ</h2>
          <p className="text-muted">{RESPONSE_FRAME}</p>
          <p className="text-muted mt-1">มี {ITEM_COUNT} ข้อ ตอบด้วยมาตรวัด 5 ระดับ ใช้เวลาประมาณ 10–15 นาที (ค่าประมาณ จนกว่าจะมีข้อมูลการใช้งานจริง) ไม่จับเวลา บันทึกอัตโนมัติ และกลับมาทำต่อได้</p>
        </section>
        <section>
          <h2 className="font-semibold">ใครเข้าถึงผลได้</h2>
          <ul className="list-disc pl-5 text-muted space-y-1">
            <li>คุณจะเห็นคะแนนของตนเองและคำแนะนำพัฒนาตน ผ่านลิงก์ส่วนตัวของคุณ</li>
            <li>ทีมรับสมัครของ {inv.orgName} จะเห็นผลของคุณเทียบกับโปรไฟล์ที่องค์กรกำหนดสำหรับตำแหน่งนี้</li>
            <li>คุณจะไม่เห็นข้อมูลของผู้สมัครคนอื่น และผู้สมัครคนอื่นไม่เห็นข้อมูลของคุณ</li>
          </ul>
        </section>
        <section>
          <h2 className="font-semibold">ข้อจำกัดของต้นแบบ</h2>
          <ul className="list-disc pl-5 text-muted space-y-1">
            <li>คะแนนเป็นพฤติกรรมที่รายงานด้วยตนเองตามสเกลของต้นแบบ ไม่ใช่การวัดทักษะ ความสามารถ ความฉลาด หรือสุขภาพจิต</li>
            <li>แบบประเมินยังไม่ผ่าน psychometric validation และไม่ได้อ้างอิงเครื่องมือเชิงพาณิชย์ใด</li>
            <li>คำอธิบายผล{ai.isDemo ? "ในโหมดนี้สร้างจากสคริปต์ (Demo) ไม่ใช่ AI จริง" : "สร้างโดย AI และองค์กรควรทบทวนก่อนใช้"}</li>
          </ul>
        </section>
        <section>
          <h2 className="font-semibold">ข้อมูลและการลบ</h2>
          <p className="text-muted">ระบบเก็บคำตอบ เวลาที่ใช้ และชื่อ/อีเมลหากคุณกรอก (ใช้เพื่อการติดต่อหรือการเข้าถึงผลเท่านั้น) องค์กรตั้งระยะเวลาเก็บไว้ที่ {inv.dataRetentionDays} วัน คุณขอลบข้อมูลได้จากหน้าผลลัพธ์ของคุณ หรือติดต่อองค์กรโดยตรง ระบบไม่ใช้เพศ อายุ ศาสนา เชื้อชาติ ความพิการ หรือข้อมูลอ่อนไหวในการคำนวณ</p>
        </section>
        <StartForm token={token} />
      </Card>
    </div>
  );
}

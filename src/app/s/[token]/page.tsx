import { redirect } from "next/navigation";
import { getSessionState } from "@/lib/services/candidateSessions";
import { ApiError } from "@/lib/util/http";
import { Alert } from "@/components/ui";
import { AssessmentRunner } from "./AssessmentRunner";

export const metadata = { title: "ทำแบบประเมิน" };

export default async function SessionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let state;
  try {
    state = await getSessionState(token);
  } catch (e) {
    return <Alert tone="danger" title="ไม่พบแบบประเมิน">{e instanceof ApiError ? e.message : "ลิงก์ไม่ถูกต้อง"} กรุณาตรวจสอบลิงก์สำหรับกลับมาทำต่อ</Alert>;
  }
  if (state.status === "completed") redirect(`/s/${token}/report`);
  return <AssessmentRunner token={token} initial={state} />;
}

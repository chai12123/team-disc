import { loadSessionByToken } from "@/lib/services/candidateSessions";
import { ensureAiReport } from "@/lib/services/reports";
import { ApiError, handleRoute, jsonOk } from "@/lib/util/http";

/** สร้าง/ดึงคำอธิบายรายงานฝั่งผู้สมัคร (เฉพาะของตนเอง) */
export const POST = handleRoute(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  const s = await loadSessionByToken(token);
  if (s.status !== "completed") throw new ApiError(409, "ยังไม่ได้ส่งแบบประเมิน", "not_completed");
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";
  const report = await ensureAiReport(s.id, "candidate", { force, rateKey: `cand:${s.id}` });
  return jsonOk({ report });
});

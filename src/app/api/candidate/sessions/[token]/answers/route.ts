import { saveAnswers, SaveAnswersSchema } from "@/lib/services/candidateSessions";
import { getClientIp, handleRoute, jsonOk, readJson } from "@/lib/util/http";
import { ipKey, rateLimit } from "@/lib/util/ratelimit";

export const PATCH = handleRoute(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  await rateLimit(`cand:save:${ipKey(getClientIp(req))}`, 600, 600);
  const body = SaveAnswersSchema.parse(await readJson(req));
  return jsonOk(await saveAnswers(token, body));
});

/** sendBeacon ส่งได้เฉพาะ POST: ใช้ handler เดียวกันกับ PATCH */
export const POST = PATCH;

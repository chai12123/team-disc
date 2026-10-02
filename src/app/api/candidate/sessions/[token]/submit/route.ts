import { submitSession } from "@/lib/services/candidateSessions";
import { getClientIp, handleRoute, jsonOk } from "@/lib/util/http";
import { ipKey, rateLimit } from "@/lib/util/ratelimit";

export const POST = handleRoute(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  await rateLimit(`cand:submit:${ipKey(getClientIp(req))}`, 30, 600);
  return jsonOk(await submitSession(token));
});

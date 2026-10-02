import { z } from "zod";
import { startSession, StartSessionSchema } from "@/lib/services/candidateSessions";
import { getClientIp, handleRoute, jsonOk, readJson } from "@/lib/util/http";
import { ipKey, rateLimit } from "@/lib/util/ratelimit";

const Schema = StartSessionSchema.extend({ token: z.string().min(16).max(200) });

export const POST = handleRoute(async (req: Request) => {
  const ip = getClientIp(req);
  await rateLimit(`cand:start:${ipKey(ip)}`, 20, 600);
  const body = Schema.parse(await readJson(req));
  const { token, ...rest } = body;
  const result = await startSession(token, rest, { ip, userAgent: req.headers.get("user-agent") });
  return jsonOk({ path: result.path, candidateCode: result.candidateCode });
});

import { z } from "zod";
import { requestDeletion } from "@/lib/services/candidateSessions";
import { getClientIp, handleRoute, jsonOk, readJson } from "@/lib/util/http";
import { ipKey, rateLimit } from "@/lib/util/ratelimit";

const Schema = z.object({ reason: z.string().max(500).default("") });

export const POST = handleRoute(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  await rateLimit(`cand:del:${ipKey(getClientIp(req))}`, 10, 600);
  const body = Schema.parse(await readJson(req));
  await requestDeletion(token, body.reason);
  return jsonOk({ requested: true });
});

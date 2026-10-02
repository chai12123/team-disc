import { getSessionState } from "@/lib/services/candidateSessions";
import { handleRoute, jsonOk } from "@/lib/util/http";

export const GET = handleRoute(async (_req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  return jsonOk(await getSessionState(token));
});

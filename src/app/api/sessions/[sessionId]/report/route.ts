import { requireOrgContext } from "@/lib/auth/server";
import { ensureAiReport, getSessionForOrg } from "@/lib/services/reports";
import { handleRoute, jsonOk } from "@/lib/util/http";

export const POST = handleRoute(async (req: Request, { params }: { params: Promise<{ sessionId: string }> }) => {
  const { sessionId } = await params;
  const ctx = await requireOrgContext();
  await getSessionForOrg(ctx.org.id, sessionId);
  const force = new URL(req.url).searchParams.get("force") === "1";
  const report = await ensureAiReport(sessionId, "organization", { force, rateKey: `org:${ctx.org.id}` });
  return jsonOk({ report });
});

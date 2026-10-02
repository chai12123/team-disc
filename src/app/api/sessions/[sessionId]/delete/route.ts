import { requireOrgAdmin } from "@/lib/auth/server";
import { deleteCandidateData } from "@/lib/services/candidates";
import { handleRoute, jsonOk } from "@/lib/util/http";

export const POST = handleRoute(async (_req: Request, { params }: { params: Promise<{ sessionId: string }> }) => {
  const { sessionId } = await params;
  const ctx = await requireOrgAdmin();
  await deleteCandidateData(ctx, sessionId);
  return jsonOk({ deleted: true });
});

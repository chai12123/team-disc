import { requireOrgContext } from "@/lib/auth/server";
import { confirmProfile } from "@/lib/services/roles";
import { handleRoute, jsonOk } from "@/lib/util/http";

export const POST = handleRoute(async (_req: Request, { params }: { params: Promise<{ roleId: string; versionId: string }> }) => {
  const { roleId, versionId } = await params;
  const ctx = await requireOrgContext();
  const version = await confirmProfile(ctx, roleId, versionId);
  return jsonOk({ version });
});

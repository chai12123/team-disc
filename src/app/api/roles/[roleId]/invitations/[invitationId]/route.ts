import { requireOrgContext } from "@/lib/auth/server";
import { revokeInvitation } from "@/lib/services/invitations";
import { handleRoute, jsonOk } from "@/lib/util/http";

export const DELETE = handleRoute(async (_req: Request, { params }: { params: Promise<{ roleId: string; invitationId: string }> }) => {
  const { roleId, invitationId } = await params;
  const ctx = await requireOrgContext();
  await revokeInvitation(ctx, roleId, invitationId);
  return jsonOk({ revoked: true });
});

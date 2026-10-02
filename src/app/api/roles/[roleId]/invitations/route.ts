import { requireOrgContext } from "@/lib/auth/server";
import { createInvitation, CreateInvitationSchema, listInvitations } from "@/lib/services/invitations";
import { baseUrlFrom } from "@/lib/util/format";
import { handleRoute, jsonOk, readJson } from "@/lib/util/http";

type Ctx = { params: Promise<{ roleId: string }> };

export const GET = handleRoute(async (_req: Request, { params }: Ctx) => {
  const { roleId } = await params;
  const ctx = await requireOrgContext();
  return jsonOk({ invitations: await listInvitations(ctx.org.id, roleId) });
});

export const POST = handleRoute(async (req: Request, { params }: Ctx) => {
  const { roleId } = await params;
  const ctx = await requireOrgContext();
  const body = CreateInvitationSchema.parse(await readJson(req));
  const inv = await createInvitation(ctx, roleId, body);
  return jsonOk({ id: inv.id, url: `${baseUrlFrom(req)}${inv.path}` });
});

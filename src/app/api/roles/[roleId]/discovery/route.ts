import { requireOrgContext } from "@/lib/auth/server";
import { DiscoveryInputSchema, listDiscoveryMessages, runDiscoveryTurn } from "@/lib/services/roles";
import { handleRoute, jsonOk, readJson } from "@/lib/util/http";

type Ctx = { params: Promise<{ roleId: string }> };

export const GET = handleRoute(async (_req: Request, { params }: Ctx) => {
  const { roleId } = await params;
  const ctx = await requireOrgContext();
  const { getRole } = await import("@/lib/services/roles");
  await getRole(ctx.org.id, roleId);
  return jsonOk({ messages: await listDiscoveryMessages(roleId) });
});

export const POST = handleRoute(async (req: Request, { params }: Ctx) => {
  const { roleId } = await params;
  const ctx = await requireOrgContext();
  const body = DiscoveryInputSchema.parse(await readJson(req));
  const result = await runDiscoveryTurn(ctx, roleId, body.message ?? null);
  return jsonOk(result);
});

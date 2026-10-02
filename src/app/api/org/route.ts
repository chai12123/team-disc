import { requireOrgAdmin } from "@/lib/auth/server";
import { updateOrg, UpdateOrgSchema } from "@/lib/services/org";
import { handleRoute, jsonOk, readJson } from "@/lib/util/http";

export const POST = handleRoute(async (req: Request) => {
  const ctx = await requireOrgAdmin();
  const body = UpdateOrgSchema.parse(await readJson(req));
  await updateOrg(ctx, body);
  return jsonOk({ updated: true });
});

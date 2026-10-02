import { z } from "zod";
import { requireOrgContext } from "@/lib/auth/server";
import { updateRole } from "@/lib/services/roles";
import { handleRoute, jsonOk, readJson } from "@/lib/util/http";

const Schema = z.object({ status: z.enum(["open", "closed"]) });

export const POST = handleRoute(async (req: Request, { params }: { params: Promise<{ roleId: string }> }) => {
  const { roleId } = await params;
  const ctx = await requireOrgContext();
  const body = Schema.parse(await readJson(req));
  await updateRole(ctx.org.id, roleId, { status: body.status });
  return jsonOk({ status: body.status });
});

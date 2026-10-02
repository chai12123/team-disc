import { requireOrgContext } from "@/lib/auth/server";
import { listProfileVersions, saveProfileDraft, getRole } from "@/lib/services/roles";
import { handleRoute, jsonOk, readJson } from "@/lib/util/http";

type Ctx = { params: Promise<{ roleId: string }> };

export const GET = handleRoute(async (_req: Request, { params }: Ctx) => {
  const { roleId } = await params;
  const ctx = await requireOrgContext();
  await getRole(ctx.org.id, roleId);
  return jsonOk({ versions: await listProfileVersions(roleId) });
});

/** บันทึกร่าง (แก้ไขโดยมนุษย์) */
export const PUT = handleRoute(async (req: Request, { params }: Ctx) => {
  const { roleId } = await params;
  const ctx = await requireOrgContext();
  const version = await saveProfileDraft(ctx, roleId, await readJson(req));
  return jsonOk({ version });
});

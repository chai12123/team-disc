import { requireOrgAdmin } from "@/lib/auth/server";
import { purgeExpiredData } from "@/lib/services/candidates";
import { handleRoute, jsonOk } from "@/lib/util/http";

export const POST = handleRoute(async () => {
  const ctx = await requireOrgAdmin();
  const deleted = await purgeExpiredData(ctx);
  return jsonOk({ deleted });
});

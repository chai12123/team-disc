import { z } from "zod";
import { requireOrgAdmin } from "@/lib/auth/server";
import { addMemberByEmail } from "@/lib/services/org";
import { handleRoute, jsonOk, readJson } from "@/lib/util/http";

const Schema = z.object({ email: z.string().email(), role: z.enum(["recruiter", "org_admin"]) });

export const POST = handleRoute(async (req: Request) => {
  const ctx = await requireOrgAdmin();
  const body = Schema.parse(await readJson(req));
  await addMemberByEmail(ctx, body.email, body.role);
  return jsonOk({ added: true });
});

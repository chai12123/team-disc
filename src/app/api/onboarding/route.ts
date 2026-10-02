import { z } from "zod";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ORG_COOKIE, requireUser } from "@/lib/auth/server";
import { createOrganizationForUser } from "@/lib/services/org";
import { handleRoute } from "@/lib/util/http";

export const POST = handleRoute(async (req: Request) => {
  const user = await requireUser();
  const form = await req.formData();
  const name = z.string().trim().min(1).max(200).parse(form.get("name"));
  const orgId = await createOrganizationForUser(user.id, name);
  const store = await cookies();
  store.set(ORG_COOKIE, orgId, { httpOnly: true, sameSite: "lax", path: "/" });
  return NextResponse.redirect(new URL("/app", req.url), { status: 303 });
});

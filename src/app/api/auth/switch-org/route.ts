import { z } from "zod";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { listMemberships, ORG_COOKIE, requireUser } from "@/lib/auth/server";
import { ApiError, handleRoute } from "@/lib/util/http";

export const POST = handleRoute(async (req: Request) => {
  const user = await requireUser();
  const form = await req.formData();
  const orgId = z.string().uuid().parse(form.get("orgId"));
  const memberships = await listMemberships(user.id);
  if (!memberships.some((m) => m.orgId === orgId)) throw new ApiError(403, "ไม่ได้เป็นสมาชิกองค์กรนี้", "forbidden");
  const store = await cookies();
  store.set(ORG_COOKIE, orgId, { httpOnly: true, sameSite: "lax", path: "/" });
  return NextResponse.redirect(new URL("/app", req.url), { status: 303 });
});

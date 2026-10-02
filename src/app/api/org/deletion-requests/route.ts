import { z } from "zod";
import { NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/auth/server";
import { deleteCandidateData } from "@/lib/services/candidates";
import { handleRoute } from "@/lib/util/http";

export const POST = handleRoute(async (req: Request) => {
  const ctx = await requireOrgAdmin();
  const form = await req.formData();
  const requestId = z.string().uuid().parse(form.get("requestId"));
  const sessionId = z.string().uuid().parse(form.get("sessionId"));
  await deleteCandidateData(ctx, sessionId, requestId);
  return NextResponse.redirect(new URL("/app/settings", req.url), { status: 303 });
});

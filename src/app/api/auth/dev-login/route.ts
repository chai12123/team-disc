import { z } from "zod";
import { cookies } from "next/headers";
import { authMode } from "@/lib/env";
import { ApiError, handleRoute, jsonOk, readJson, getClientIp } from "@/lib/util/http";
import { DEV_COOKIE, signDevSession } from "@/lib/auth/devSession";
import { findOrCreateDevUser } from "@/lib/services/org";
import { rateLimit, ipKey } from "@/lib/util/ratelimit";

const Schema = z.object({ email: z.string().email().max(200), displayName: z.string().max(120).optional() });

export const POST = handleRoute(async (req: Request) => {
  if (authMode() !== "dev") throw new ApiError(404, "ไม่พบ", "not_found");
  await rateLimit(`dev-login:${ipKey(getClientIp(req))}`, 30, 600);
  const body = Schema.parse(await readJson(req));
  const userId = await findOrCreateDevUser(body.email, body.displayName);
  const store = await cookies();
  store.set(DEV_COOKIE, signDevSession(userId), { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
  return jsonOk({ userId });
});

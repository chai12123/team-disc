import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authMode } from "@/lib/env";
import { DEV_COOKIE } from "@/lib/auth/devSession";
import { ORG_COOKIE } from "@/lib/auth/server";

export async function POST(req: Request) {
  const store = await cookies();
  store.delete(DEV_COOKIE);
  store.delete(ORG_COOKIE);
  if (authMode() === "supabase") {
    const { createSupabaseServerClient } = await import("@/lib/auth/supabase");
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}

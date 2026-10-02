import { NextResponse } from "next/server";
import { authMode } from "@/lib/env";

/** รับ code จากอีเมลยืนยันของ Supabase แล้วแลกเป็น session */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (authMode() === "supabase" && code) {
    const { createSupabaseServerClient } = await import("@/lib/auth/supabase");
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL("/", req.url));
}

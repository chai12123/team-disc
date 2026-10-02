/** การอ่าน environment แบบรวมศูนย์ (ฝั่ง server เท่านั้น ยกเว้น NEXT_PUBLIC_*) */
export const env = {
  get databaseUrl() {
    return process.env.DATABASE_URL ?? "";
  },
  get supabaseUrl() {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  },
  get supabaseAnonKey() {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  },
  get appSecret() {
    return process.env.APP_SECRET ?? "";
  },
  get anthropicApiKey() {
    return process.env.ANTHROPIC_API_KEY ?? "";
  },
  get anthropicModel() {
    return process.env.ANTHROPIC_MODEL ?? "";
  },
  get aiTimeoutMs() {
    const n = Number(process.env.AI_TIMEOUT_MS ?? "60000");
    return Number.isFinite(n) && n > 1000 ? n : 60000;
  },
  get appUrl() {
    return process.env.NEXT_PUBLIC_APP_URL ?? "";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};

export function supabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}

/** โหมด auth: supabase เมื่อมีค่าครบ, dev เมื่อ AUTH_MODE=dev และไม่ใช่ production (หรือเปิดชัดเจน) */
export function authMode(): "supabase" | "dev" {
  const forced = (process.env.AUTH_MODE ?? "").toLowerCase();
  if (forced === "supabase") return "supabase";
  if (forced === "dev") {
    if (env.isProduction && process.env.ALLOW_DEV_AUTH_IN_PRODUCTION !== "1") {
      // ป้องกันเปิด dev login บน production โดยไม่ตั้งใจ
      return supabaseConfigured() ? "supabase" : "dev";
    }
    return "dev";
  }
  return supabaseConfigured() ? "supabase" : "dev";
}

/** ผู้ให้บริการ AI: claude เมื่อมี key, มิฉะนั้น demo (override ได้ด้วย AI_PROVIDER) */
export function aiProvider(): "claude" | "demo" {
  const forced = (process.env.AI_PROVIDER ?? "").toLowerCase();
  if (forced === "demo") return "demo";
  if (forced === "claude") return env.anthropicApiKey ? "claude" : "demo";
  return env.anthropicApiKey ? "claude" : "demo";
}

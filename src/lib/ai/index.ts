import { aiProvider, env } from "@/lib/env";
import { ClaudeAdapter } from "./claude";
import { DemoAdapter } from "./demo";
import type { AIAdapter } from "./types";

export * from "./types";
export * from "./schemas";

/**
 * จุดเชื่อมต่อเดียว: เปลี่ยน provider ได้ด้วย env อย่างเดียว
 * - มี ANTHROPIC_API_KEY → ClaudeAdapter (model จาก ANTHROPIC_MODEL)
 * - ไม่มี → DemoAdapter (scripted, ติดป้าย Demo)
 */
export function getAIAdapter(): AIAdapter {
  if (aiProvider() === "claude") return new ClaudeAdapter();
  return new DemoAdapter();
}

export interface AIStatus {
  provider: "claude" | "demo";
  model: string;
  isDemo: boolean;
}

export function getAIStatus(): AIStatus {
  const provider = aiProvider();
  return {
    provider,
    model: provider === "claude" ? env.anthropicModel || "(ANTHROPIC_MODEL ไม่ได้ตั้งค่า)" : "scripted-demo-v1",
    isDemo: provider === "demo",
  };
}

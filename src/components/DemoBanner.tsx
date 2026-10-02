import { getAIStatus } from "@/lib/ai";
import { authMode } from "@/lib/env";

/** ป้ายสถานะ Demo/Dev ชัดเจน ไม่แอบอ้างว่าเป็น AI จริง */
export function DemoBanner() {
  const ai = getAIStatus();
  const dev = authMode() === "dev";
  if (!ai.isDemo && !dev) return null;
  return (
    <div className="no-print bg-amber-50 border-b border-amber-200 text-amber-900 text-xs sm:text-sm px-4 py-2 text-center" role="status">
      {ai.isDemo && (
        <span>
          <strong>Demo mode:</strong> บทสนทนาและคำอธิบายรายงานมาจากสคริปต์ที่กำหนดไว้ ไม่ใช่ AI จริง (ตั้งค่า ANTHROPIC_API_KEY เพื่อเชื่อม Claude)
        </span>
      )}
      {ai.isDemo && dev && <span> · </span>}
      {dev && <span><strong>Dev login:</strong> ใช้บัญชีทดลองในเครื่อง (ยังไม่ได้เชื่อม Supabase Auth)</span>}
    </div>
  );
}

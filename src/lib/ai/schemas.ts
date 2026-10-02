import { z } from "zod";
import { AXES, type AxisKey } from "@/lib/model/axes";
import { RoleProfileSchema, type RoleProfile } from "@/lib/model/roleProfile";
import { METHODOLOGY_VERSION } from "@/lib/model/versions";

/**
 * Schema สำหรับ JSON ที่ AI ส่งกลับ (ทุกฟิลด์ required เพื่อให้ structured output เข้มงวด)
 * จากนั้น normalize เป็น RoleProfile ภายใน และ validate อีกครั้งด้วย RoleProfileSchema
 */
const AiAxisSchema = z.object({
  targetMin: z.number(),
  targetMax: z.number(),
  weight: z.number(),
  rationale: z.string(),
  evidenceFromConversation: z.array(z.string()),
});

const aiAxesShape = Object.fromEntries(AXES.map((k) => [k, AiAxisSchema])) as Record<AxisKey, typeof AiAxisSchema>;

export const AiRoleProfileSchema = z.object({
  roleTitle: z.string(),
  level: z.string(),
  responsibilities: z.array(z.string()),
  successOutcomes: z.array(z.string()),
  workContext: z.object({
    decisionSpeed: z.string(),
    costOfError: z.string(),
    routineVsChange: z.string(),
    authorityLevel: z.string(),
    teamAndManagerStyle: z.string(),
    supportAvailable: z.string(),
    frequentSituations: z.array(z.string()),
  }),
  requiredSkills: z.array(z.string()),
  unresolvedQuestions: z.array(z.string()),
  axes: z.object(aiAxesShape),
  assumptions: z.array(z.string()),
});
export type AiRoleProfile = z.infer<typeof AiRoleProfileSchema>;

export const DiscoveryQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  options: z.array(z.string()),
});

export const DiscoveryTurnSchema = z.object({
  /** ข้อความสั้น ๆ ที่ AI ตอบกลับ (สะท้อนสิ่งที่เข้าใจ/ชี้ความขัดแย้ง) */
  assistantMessage: z.string(),
  /** ถามครั้งละ 1–2 คำถาม; ว่างเมื่อ phase = ready */
  questions: z.array(DiscoveryQuestionSchema),
  /** asking = ยังถามต่อ, ready = ข้อมูลพอแล้ว มี proposedProfile */
  phase: z.enum(["asking", "ready"]),
  conflictsNoticed: z.array(z.string()),
  knownGaps: z.array(z.string()),
  proposedProfile: AiRoleProfileSchema.nullable(),
});
export type DiscoveryTurn = z.infer<typeof DiscoveryTurnSchema>;

export const CandidateReportSchema = z.object({
  summary: z.string(),
  tendencies: z.array(z.object({ axis: z.enum(AXES), text: z.string() })),
  possibleStrengths: z.array(z.string()),
  situationsToAdapt: z.array(z.string()),
  communicationTips: z.array(z.string()),
  selfDevelopmentIdeas: z.array(z.string()),
  dataLimitations: z.array(z.string()),
});
export type CandidateReport = z.infer<typeof CandidateReportSchema>;

export const OrganizationReportSchema = z.object({
  summary: z.string(),
  alignmentPoints: z.array(z.string()),
  differencesToExplore: z.array(z.string()),
  interviewQuestions: z.array(
    z.object({ question: z.string(), linkedAxis: z.enum(AXES), whyThis: z.string() }),
  ),
  workSampleIdeas: z.array(z.string()),
  managerAdjustments: z.array(z.string()),
  candidateAdjustments: z.array(z.string()),
  onboardingPlan30Days: z.array(z.object({ period: z.string(), focus: z.array(z.string()) })),
  cautions: z.array(z.string()),
});
export type OrganizationReport = z.infer<typeof OrganizationReportSchema>;

export function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/** แปลงผลจาก AI เป็น RoleProfile ภายใน: clamp ค่า, บังคับ min ≤ max, น้ำหนัก ≥ 0 */
export function normalizeAiProfile(ai: AiRoleProfile, fallbackTitle: string): RoleProfile {
  const axes = Object.fromEntries(
    AXES.map((k) => {
      const a = ai.axes[k];
      let min = Math.round(clamp(a.targetMin, 0, 100));
      let max = Math.round(clamp(a.targetMax, 0, 100));
      if (min > max) [min, max] = [max, min];
      return [
        k,
        {
          targetMin: min,
          targetMax: max,
          weight: Math.round(clamp(a.weight, 0, 10) * 10) / 10,
          rationale: a.rationale.slice(0, 2000),
          evidenceFromConversation: a.evidenceFromConversation.slice(0, 20).map((s) => s.slice(0, 1000)),
        },
      ];
    }),
  ) as RoleProfile["axes"];
  const candidate = {
    roleTitle: (ai.roleTitle || fallbackTitle).slice(0, 200),
    level: ai.level.slice(0, 100),
    responsibilities: ai.responsibilities.slice(0, 30),
    successOutcomes: ai.successOutcomes.slice(0, 30),
    workContext: {
      ...ai.workContext,
      frequentSituations: ai.workContext.frequentSituations.slice(0, 20),
    },
    requiredSkills: ai.requiredSkills.slice(0, 30),
    unresolvedQuestions: ai.unresolvedQuestions.slice(0, 30),
    axes,
    assumptions: ai.assumptions.slice(0, 30),
    methodologyVersion: METHODOLOGY_VERSION,
  };
  // ถ้าน้ำหนักเป็น 0 ทั้งหมด ให้ตั้งเป็น 1 ทุกแกนและบันทึกเป็นสมมติฐาน (มนุษย์ปรับได้ก่อนยืนยัน)
  const weightSum = AXES.reduce((s, k) => s + candidate.axes[k].weight, 0);
  if (weightSum <= 0) {
    for (const k of AXES) candidate.axes[k].weight = 1;
    candidate.assumptions.push("AI ไม่ได้ให้น้ำหนักแกนใดเลย ระบบตั้งน้ำหนักเท่ากันทุกแกนไว้ก่อน กรุณาปรับ");
  }
  return RoleProfileSchema.parse(candidate);
}

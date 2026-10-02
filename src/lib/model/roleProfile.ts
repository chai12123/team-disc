import { z } from "zod";
import { AXES, type AxisKey } from "./axes";

/**
 * โปรไฟล์เป้าหมายของบทบาทงาน (rubric เชิงทดลองที่ AI เสนอและมนุษย์ปรับ/ยืนยัน)
 * ไม่ใช่ผลวัดบุคลิกขององค์กร
 */
export const AxisTargetSchema = z
  .object({
    targetMin: z.number().min(0).max(100),
    targetMax: z.number().min(0).max(100),
    weight: z.number().min(0).max(10),
    rationale: z.string().max(2000).default(""),
    evidenceFromConversation: z.array(z.string().max(1000)).max(20).default([]),
  })
  .refine((a) => a.targetMin <= a.targetMax, {
    message: "targetMin ต้องไม่มากกว่า targetMax",
  });

export type AxisTarget = z.infer<typeof AxisTargetSchema>;

const axesShape = Object.fromEntries(AXES.map((k) => [k, AxisTargetSchema])) as Record<
  AxisKey,
  typeof AxisTargetSchema
>;

export const RoleProfileSchema = z
  .object({
    roleTitle: z.string().min(1).max(200),
    level: z.string().max(100).default(""),
    responsibilities: z.array(z.string().max(1000)).max(30).default([]),
    successOutcomes: z.array(z.string().max(1000)).max(30).default([]),
    workContext: z
      .object({
        decisionSpeed: z.string().max(500).default(""),
        costOfError: z.string().max(500).default(""),
        routineVsChange: z.string().max(500).default(""),
        authorityLevel: z.string().max(500).default(""),
        teamAndManagerStyle: z.string().max(1000).default(""),
        supportAvailable: z.string().max(1000).default(""),
        frequentSituations: z.array(z.string().max(500)).max(20).default([]),
      })
      .prefault({}),
    requiredSkills: z.array(z.string().max(500)).max(30).default([]),
    unresolvedQuestions: z.array(z.string().max(1000)).max(30).default([]),
    axes: z.object(axesShape),
    assumptions: z.array(z.string().max(1000)).max(30).default([]),
    methodologyVersion: z.string().min(1).max(50),
  })
  .refine((p) => AXES.reduce((s, k) => s + p.axes[k].weight, 0) > 0, {
    message: "ผลรวมน้ำหนักทุกแกนต้องมากกว่า 0",
    path: ["axes"],
  });

export type RoleProfile = z.infer<typeof RoleProfileSchema>;

/** โครงสร้างย่อสำหรับ scoring engine */
export type AxisTargets = Record<AxisKey, { targetMin: number; targetMax: number; weight: number }>;

export function toAxisTargets(profile: RoleProfile): AxisTargets {
  return Object.fromEntries(
    AXES.map((k) => [
      k,
      {
        targetMin: profile.axes[k].targetMin,
        targetMax: profile.axes[k].targetMax,
        weight: profile.axes[k].weight,
      },
    ]),
  ) as AxisTargets;
}

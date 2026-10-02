import { AXES, type AxisKey } from "@/lib/model/axes";
import type { AssessmentItem } from "@/lib/assessment/items";
import type { AxisTargets } from "@/lib/model/roleProfile";
import { SCORING_VERSION } from "@/lib/model/versions";

/**
 * Scoring engine ของ TeamFit — คำนวณด้วยโค้ดเท่านั้น AI ไม่มีสิทธิ์สร้างหรือแก้คะแนน
 *
 * คะแนนแต่ละแกน ("คะแนนตามสเกลของต้นแบบ", ไม่ใช่ percentile, ไม่ normed):
 *   ข้อปกติใช้ r, ข้อกลับคะแนนใช้ 6 − r
 *   scaleScore = 100 × (mean(scoredAnswers) − 1) / 4
 *
 * Alignment ต่อแกน j:
 *   distance_j  = max(L_j − c_j, 0, c_j − U_j)
 *   alignment_j = 100 − distance_j
 *   overall     = Σ(w_j × alignment_j) / Σ(w_j)
 */

export type LikertValue = 1 | 2 | 3 | 4 | 5;

export interface ResponseInput {
  itemId: string;
  value: number;
  answeredAt?: string | Date | null;
}

export class ScoringError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INCOMPLETE"
      | "INVALID_VALUE"
      | "UNKNOWN_ITEM"
      | "INVALID_TARGET"
      | "ZERO_WEIGHT"
      | "INVALID_SCORE",
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ScoringError";
  }
}

export function isLikert(v: unknown): v is LikertValue {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;
}

export function scoreAnswer(item: Pick<AssessmentItem, "reverseScored">, value: LikertValue): number {
  return item.reverseScored ? 6 - value : value;
}

export interface ScaleScoreDetail {
  axis: AxisKey;
  score: number; // 0–100, ปัดทศนิยม 1 ตำแหน่งสำหรับแสดงผล; เก็บค่าเต็มใน raw
  raw: number;
  itemCount: number;
  meanScored: number;
}

export type ScaleScores = Record<AxisKey, number>;

export interface ScaleScoreResult {
  scoringVersion: string;
  scores: ScaleScores;
  details: ScaleScoreDetail[];
}

/** ตรวจความครบถ้วนโดยไม่คำนวณ */
export function missingItemIds(items: AssessmentItem[], responses: ResponseInput[]): string[] {
  const answered = new Set(responses.map((r) => r.itemId));
  return items.filter((it) => !answered.has(it.id)).map((it) => it.id);
}

export function computeScaleScores(items: AssessmentItem[], responses: ResponseInput[]): ScaleScoreResult {
  const byId = new Map(items.map((it) => [it.id, it]));
  const answers = new Map<string, LikertValue>();
  for (const r of responses) {
    const item = byId.get(r.itemId);
    if (!item) throw new ScoringError(`ไม่รู้จักข้อ ${r.itemId}`, "UNKNOWN_ITEM", { itemId: r.itemId });
    if (!isLikert(r.value)) {
      throw new ScoringError(`ค่าคำตอบของข้อ ${r.itemId} ไม่ถูกต้อง`, "INVALID_VALUE", {
        itemId: r.itemId,
        value: r.value,
      });
    }
    answers.set(r.itemId, r.value);
  }
  const missing = items.filter((it) => !answers.has(it.id)).map((it) => it.id);
  if (missing.length > 0) {
    throw new ScoringError(`ยังตอบไม่ครบ (ขาด ${missing.length} ข้อ)`, "INCOMPLETE", { missing });
  }

  const details: ScaleScoreDetail[] = [];
  const scores = {} as ScaleScores;
  for (const axis of AXES) {
    const axisItems = items.filter((it) => it.scale === axis);
    if (axisItems.length === 0) {
      throw new ScoringError(`ไม่มีข้อคำถามของแกน ${axis}`, "INCOMPLETE", { axis });
    }
    const scored = axisItems.map((it) => scoreAnswer(it, answers.get(it.id)!));
    const mean = scored.reduce((a, b) => a + b, 0) / scored.length;
    const raw = (100 * (mean - 1)) / 4;
    const score = Math.round(raw * 10) / 10;
    scores[axis] = score;
    details.push({ axis, score, raw, itemCount: axisItems.length, meanScored: mean });
  }
  return { scoringVersion: SCORING_VERSION, scores, details };
}

export interface AxisAlignment {
  axis: AxisKey;
  candidateScore: number;
  targetMin: number;
  targetMax: number;
  weight: number;
  distance: number;
  alignment: number;
  /** w_j × alignment_j / Σw (ส่วนที่แกนนี้มีต่อผลรวม) */
  contribution: number;
  position: "below" | "within" | "above";
}

export interface AlignmentResult {
  scoringVersion: string;
  overall: number; // จำนวนเต็ม 0–100
  overallRaw: number;
  weightSum: number;
  axes: AxisAlignment[];
}

export function validateTargets(targets: AxisTargets): void {
  let weightSum = 0;
  for (const axis of AXES) {
    const t = targets[axis];
    if (!t) throw new ScoringError(`ไม่มีช่วงเป้าหมายของแกน ${axis}`, "INVALID_TARGET", { axis });
    const { targetMin, targetMax, weight } = t;
    if (![targetMin, targetMax, weight].every((n) => typeof n === "number" && Number.isFinite(n))) {
      throw new ScoringError(`ค่าเป้าหมายของแกน ${axis} ไม่ใช่ตัวเลข`, "INVALID_TARGET", { axis });
    }
    if (targetMin < 0 || targetMax > 100 || targetMin > targetMax) {
      throw new ScoringError(`ช่วงเป้าหมายของแกน ${axis} ต้องเป็น 0 ≤ min ≤ max ≤ 100`, "INVALID_TARGET", {
        axis,
        targetMin,
        targetMax,
      });
    }
    if (weight < 0) throw new ScoringError(`น้ำหนักของแกน ${axis} ต้องไม่ติดลบ`, "INVALID_TARGET", { axis });
    weightSum += weight;
  }
  if (weightSum <= 0) throw new ScoringError("ผลรวมน้ำหนักทุกแกนต้องมากกว่า 0", "ZERO_WEIGHT");
}

export function computeAlignment(scores: ScaleScores, targets: AxisTargets): AlignmentResult {
  validateTargets(targets);
  for (const axis of AXES) {
    const c = scores[axis];
    if (typeof c !== "number" || !Number.isFinite(c) || c < 0 || c > 100) {
      throw new ScoringError(`คะแนนของแกน ${axis} ต้องอยู่ใน 0–100`, "INVALID_SCORE", { axis, score: c });
    }
  }
  const weightSum = AXES.reduce((s, k) => s + targets[k].weight, 0);
  const axes: AxisAlignment[] = AXES.map((axis) => {
    const c = scores[axis];
    const { targetMin: L, targetMax: U, weight: w } = targets[axis];
    const distance = Math.max(L - c, 0, c - U);
    const alignment = 100 - distance;
    const contribution = (w * alignment) / weightSum;
    const position: AxisAlignment["position"] = c < L ? "below" : c > U ? "above" : "within";
    return {
      axis,
      candidateScore: c,
      targetMin: L,
      targetMax: U,
      weight: w,
      distance,
      alignment,
      contribution,
      position,
    };
  });
  const overallRaw = axes.reduce((s, a) => s + a.contribution, 0);
  return {
    scoringVersion: SCORING_VERSION,
    overall: Math.round(overallRaw),
    overallRaw,
    weightSum,
    axes,
  };
}

/* ---------------- Response quality (แยกจาก alignment, ไม่ใช่เครื่องจับโกหก) ---------------- */

export interface PairDifference {
  pairGroup: string;
  itemIds: string[];
  /** ความต่างของคะแนนหลังกลับคะแนนแล้ว (0 = ตอบไปทางเดียวกันพอดี) */
  difference: number;
}

export interface ResponseQuality {
  complete: boolean;
  answeredCount: number;
  totalCount: number;
  durationSeconds: number | null;
  /** ช่วงที่เลือกค่าเดิมติดต่อกันยาวที่สุด (ตามลำดับที่แสดง) */
  longestSameValueRun: number;
  /** สัดส่วนคำตอบที่เป็นค่าที่ใช้บ่อยที่สุด */
  mostFrequentValueShare: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  pairDifferences: PairDifference[];
  meanPairDifference: number | null;
  notes: string[];
}

export function computeResponseQuality(
  items: AssessmentItem[],
  itemOrder: string[],
  responses: ResponseInput[],
  timing: { startedAt?: Date | string | null; submittedAt?: Date | string | null },
): ResponseQuality {
  const byId = new Map(items.map((it) => [it.id, it]));
  const answers = new Map<string, number>();
  for (const r of responses) if (byId.has(r.itemId) && isLikert(r.value)) answers.set(r.itemId, r.value);

  const distribution: ResponseQuality["distribution"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const id of itemOrder) {
    const v = answers.get(id);
    if (v === undefined) {
      prev = null;
      run = 0;
      continue;
    }
    distribution[v as 1 | 2 | 3 | 4 | 5]++;
    run = v === prev ? run + 1 : 1;
    prev = v;
    longest = Math.max(longest, run);
  }
  const answeredCount = answers.size;
  const maxCount = Math.max(...Object.values(distribution));
  const mostFrequentValueShare = answeredCount > 0 ? maxCount / answeredCount : 0;

  const pairs = new Map<string, AssessmentItem[]>();
  for (const it of items) {
    if (!it.pairGroup) continue;
    pairs.set(it.pairGroup, [...(pairs.get(it.pairGroup) ?? []), it]);
  }
  const pairDifferences: PairDifference[] = [];
  for (const [pairGroup, group] of pairs) {
    if (group.length < 2) continue;
    const scored = group.map((it) => {
      const v = answers.get(it.id);
      return v === undefined ? null : scoreAnswer(it, v as LikertValue);
    });
    if (scored.some((s) => s === null)) continue;
    const nums = scored as number[];
    pairDifferences.push({
      pairGroup,
      itemIds: group.map((g) => g.id),
      difference: Math.max(...nums) - Math.min(...nums),
    });
  }
  const meanPairDifference =
    pairDifferences.length > 0
      ? pairDifferences.reduce((s, p) => s + p.difference, 0) / pairDifferences.length
      : null;

  let durationSeconds: number | null = null;
  if (timing.startedAt && timing.submittedAt) {
    const a = new Date(timing.startedAt).getTime();
    const b = new Date(timing.submittedAt).getTime();
    if (Number.isFinite(a) && Number.isFinite(b) && b >= a) durationSeconds = Math.round((b - a) / 1000);
  }

  const notes: string[] = [];
  const complete = answeredCount === items.length;
  if (!complete) notes.push(`ตอบแล้ว ${answeredCount} จาก ${items.length} ข้อ ยังไม่สมบูรณ์`);
  if (longest >= 12) notes.push(`มีช่วงที่เลือกค่าเดิมติดต่อกัน ${longest} ข้อ อาจควรสอบถามบริบทเพิ่ม`);
  if (mostFrequentValueShare >= 0.7 && answeredCount >= 16)
    notes.push("คำตอบส่วนใหญ่กระจุกที่ค่าเดียว ซึ่งเกิดได้จากหลายสาเหตุ ไม่ควรสรุปว่าไม่ตั้งใจตอบ");
  if (meanPairDifference !== null && meanPairDifference >= 2.5)
    notes.push("คู่ข้อที่ใกล้เคียงกันมีความต่างค่อนข้างมาก อาจชวนคุยถึงบริบทของแต่ละสถานการณ์");
  if (durationSeconds !== null && durationSeconds < 180 && complete)
    notes.push("ใช้เวลาน้อยกว่า 3 นาที ซึ่งเป็นข้อสังเกตเท่านั้น ไม่ได้บ่งชี้ความตั้งใจ");

  return {
    complete,
    answeredCount,
    totalCount: items.length,
    durationSeconds,
    longestSameValueRun: longest,
    mostFrequentValueShare,
    distribution,
    pairDifferences,
    meanPairDifference,
    notes,
  };
}

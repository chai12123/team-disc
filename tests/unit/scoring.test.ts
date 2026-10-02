import { describe, it, expect } from "vitest";
import { ITEM_BANK, ITEM_ORDER, ITEM_COUNT } from "@/lib/assessment/items";
import { AXES } from "@/lib/model/axes";
import {
  computeScaleScores,
  computeAlignment,
  computeResponseQuality,
  ScoringError,
  type ResponseInput,
} from "@/lib/scoring";
import type { AxisTargets } from "@/lib/model/roleProfile";

function allAnswers(value: number | ((itemId: string, reverse: boolean) => number)): ResponseInput[] {
  return ITEM_BANK.map((it) => ({
    itemId: it.id,
    value: typeof value === "function" ? value(it.id, it.reverseScored) : value,
  }));
}

function targets(partial: Partial<Record<string, [number, number, number]>> = {}, def: [number, number, number] = [0, 100, 1]): AxisTargets {
  return Object.fromEntries(
    AXES.map((k) => {
      const [targetMin, targetMax, weight] = partial[k] ?? def;
      return [k, { targetMin, targetMax, weight }];
    }),
  ) as AxisTargets;
}

describe("item bank", () => {
  it("has 64 items, 8 per axis, with reverse items in every axis and unique ids", () => {
    expect(ITEM_COUNT).toBe(64);
    expect(new Set(ITEM_BANK.map((i) => i.id)).size).toBe(64);
    for (const axis of AXES) {
      const items = ITEM_BANK.filter((i) => i.scale === axis);
      expect(items).toHaveLength(8);
      expect(items.some((i) => i.reverseScored)).toBe(true);
      expect(items.some((i) => !i.reverseScored)).toBe(true);
      expect(items.filter((i) => i.pairGroup).length).toBeGreaterThanOrEqual(2);
    }
    expect(ITEM_ORDER).toHaveLength(64);
    expect(new Set(ITEM_ORDER).size).toBe(64);
  });
});

describe("computeScaleScores", () => {
  it("gives 0 on every axis when normal items = 1 and reverse items = 5", () => {
    const res = computeScaleScores(ITEM_BANK, allAnswers((_, rev) => (rev ? 5 : 1)));
    for (const axis of AXES) expect(res.scores[axis]).toBe(0);
  });
  it("gives 100 on every axis when normal items = 5 and reverse items = 1", () => {
    const res = computeScaleScores(ITEM_BANK, allAnswers((_, rev) => (rev ? 1 : 5)));
    for (const axis of AXES) expect(res.scores[axis]).toBe(100);
  });
  it("gives 50 on every axis for all-middle answers", () => {
    const res = computeScaleScores(ITEM_BANK, allAnswers(3));
    for (const axis of AXES) expect(res.scores[axis]).toBe(50);
  });
  it("applies reverse scoring as 6 - r", () => {
    // ทุกข้อตอบ 5: ข้อปกติได้ 5, ข้อกลับได้ 1
    const res = computeScaleScores(ITEM_BANK, allAnswers(5));
    for (const axis of AXES) {
      const items = ITEM_BANK.filter((i) => i.scale === axis);
      const n = items.length;
      const rev = items.filter((i) => i.reverseScored).length;
      const mean = ((n - rev) * 5 + rev * 1) / n;
      expect(res.scores[axis]).toBeCloseTo(Math.round(((100 * (mean - 1)) / 4) * 10) / 10, 5);
    }
  });
  it("rejects incomplete responses without filling in answers", () => {
    const partial = allAnswers(3).slice(0, 63);
    expect(() => computeScaleScores(ITEM_BANK, partial)).toThrowError(ScoringError);
    try {
      computeScaleScores(ITEM_BANK, partial);
    } catch (e) {
      expect((e as ScoringError).code).toBe("INCOMPLETE");
      expect((e as ScoringError).details?.missing).toHaveLength(1);
    }
  });
  it("rejects out-of-range or non-integer values and unknown items", () => {
    const bad = allAnswers(3);
    bad[0] = { ...bad[0], value: 6 };
    expect(() => computeScaleScores(ITEM_BANK, bad)).toThrowError(/ไม่ถูกต้อง/);
    const frac = allAnswers(3);
    frac[1] = { ...frac[1], value: 2.5 };
    expect(() => computeScaleScores(ITEM_BANK, frac)).toThrowError(ScoringError);
    expect(() => computeScaleScores(ITEM_BANK, [...allAnswers(3), { itemId: "X1", value: 3 }])).toThrowError(
      /ไม่รู้จัก/,
    );
  });
});

describe("computeAlignment", () => {
  const mid = Object.fromEntries(AXES.map((k) => [k, 50])) as Record<(typeof AXES)[number], number>;

  it("is 100 when every score is within range", () => {
    const res = computeAlignment(mid, targets({}, [40, 60, 1]));
    expect(res.overall).toBe(100);
    for (const a of res.axes) {
      expect(a.distance).toBe(0);
      expect(a.position).toBe("within");
    }
  });
  it("uses distance below/above range and weights", () => {
    const scores = { ...mid, D: 20, C: 90 }; // D ต่ำกว่า 40 อยู่ 20, C สูงกว่า 60 อยู่ 30
    const t = targets({ D: [40, 60, 2], C: [40, 60, 1] }, [40, 60, 0]);
    const res = computeAlignment(scores, t);
    const d = res.axes.find((a) => a.axis === "D")!;
    const c = res.axes.find((a) => a.axis === "C")!;
    expect(d.distance).toBe(20);
    expect(d.alignment).toBe(80);
    expect(d.position).toBe("below");
    expect(c.distance).toBe(30);
    expect(c.alignment).toBe(70);
    expect(c.position).toBe("above");
    // overall = (2*80 + 1*70) / 3 = 76.67 → 77
    expect(res.overallRaw).toBeCloseTo(76.6667, 3);
    expect(res.overall).toBe(77);
    expect(Number.isInteger(res.overall)).toBe(true);
    // contributions รวมเท่ากับ overallRaw
    expect(res.axes.reduce((s, a) => s + a.contribution, 0)).toBeCloseTo(res.overallRaw, 6);
  });
  it("wider ranges and different weights change the overall", () => {
    const scores = { ...mid, D: 20 };
    const narrow = computeAlignment(scores, targets({ D: [40, 60, 1] }, [40, 60, 1]));
    const wide = computeAlignment(scores, targets({ D: [10, 60, 1] }, [40, 60, 1]));
    const heavy = computeAlignment(scores, targets({ D: [40, 60, 5] }, [40, 60, 1]));
    expect(wide.overall).toBeGreaterThan(narrow.overall);
    expect(heavy.overall).toBeLessThan(narrow.overall);
  });
  it("rejects all-zero weights", () => {
    expect(() => computeAlignment(mid, targets({}, [40, 60, 0]))).toThrowError(/น้ำหนัก/);
  });
  it("rejects invalid target ranges and scores", () => {
    expect(() => computeAlignment(mid, targets({ D: [70, 60, 1] }))).toThrowError(ScoringError);
    expect(() => computeAlignment(mid, targets({ D: [-1, 60, 1] }))).toThrowError(ScoringError);
    expect(() => computeAlignment(mid, targets({ D: [0, 101, 1] }))).toThrowError(ScoringError);
    expect(() => computeAlignment(mid, targets({ D: [0, 100, -1] }))).toThrowError(ScoringError);
    expect(() => computeAlignment({ ...mid, D: 101 }, targets())).toThrowError(ScoringError);
  });
  it("handles weight-zero axes by contributing nothing", () => {
    const scores = { ...mid, CD: 100 };
    const res = computeAlignment(scores, targets({ CD: [0, 10, 0] }, [40, 60, 1]));
    expect(res.axes.find((a) => a.axis === "CD")!.contribution).toBe(0);
    expect(res.overall).toBe(100);
  });
});

describe("computeResponseQuality", () => {
  it("flags incompleteness and straight-lining without judging honesty", () => {
    const first40 = ITEM_ORDER.slice(0, 40).map((itemId) => ({ itemId, value: 4 }));
    const q = computeResponseQuality(ITEM_BANK, ITEM_ORDER, first40, {});
    expect(q.complete).toBe(false);
    expect(q.answeredCount).toBe(40);
    expect(q.longestSameValueRun).toBe(40);
    expect(q.notes.join(" ")).not.toMatch(/โกหก/);
  });
  it("computes pair differences after reverse scoring", () => {
    // ตอบข้อปกติ 5 และข้อกลับ 1 → หลังกลับคะแนนตรงกัน → ความต่าง 0
    const q = computeResponseQuality(ITEM_BANK, ITEM_ORDER, allAnswers((_, rev) => (rev ? 1 : 5)), {
      startedAt: "2026-01-01T00:00:00Z",
      submittedAt: "2026-01-01T00:12:00Z",
    });
    expect(q.complete).toBe(true);
    expect(q.pairDifferences.length).toBeGreaterThanOrEqual(8);
    expect(q.meanPairDifference).toBe(0);
    expect(q.durationSeconds).toBe(720);
  });
});

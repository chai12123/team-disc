import { AXES, AXIS_DEFINITIONS, type AxisKey } from "@/lib/model/axes";
import {
  CandidateReportSchema,
  DiscoveryTurnSchema,
  OrganizationReportSchema,
  type AiRoleProfile,
  type CandidateReport,
  type DiscoveryTurn,
  type OrganizationReport,
} from "./schemas";
import type { AIAdapter, AIResult, DiscoveryInput, ReportInput, TranscriptMessage } from "./types";

/**
 * Demo adapter — scripted ไม่ใช่ AI จริง
 * ใช้เพื่อทดสอบ flow เมื่อยังไม่มี ANTHROPIC_API_KEY
 * ทุกผลลัพธ์ติดป้าย provider = "demo" และ UI แสดง "Demo mode" ชัดเจน
 * กติกาเดียวกับ AI จริง: ไม่อนุมานจากชื่อตำแหน่ง ทุกช่วงเป้าหมายอ้างอิงคำตอบในบทสนทนา
 */

interface ScriptQuestion {
  id: string;
  text: string;
  options: string[];
  /** ข้อนี้ถามเฉพาะเมื่อเงื่อนไขเป็นจริง */
  when?: (answers: Record<string, string>) => boolean;
}

export const DEMO_SCRIPT: ScriptQuestion[] = [
  {
    id: "level_duties",
    text: "ตำแหน่งนี้อยู่ระดับไหน และหน้าที่หลักที่ต้องทำทุกสัปดาห์คืออะไร (เลือกระดับ แล้วพิมพ์หน้าที่หลักเพิ่มได้)",
    options: ["ระดับปฏิบัติการ", "ระดับอาวุโส/หัวหน้าทีม", "ระดับผู้จัดการขึ้นไป"],
  },
  {
    id: "outcome_90",
    text: "ใน 90 วันแรก อะไรคือผลลัพธ์ที่ถ้าไม่เกิดจะถือว่ายังไม่สำเร็จ?",
    options: ["ตัวเลข/ยอดที่วัดได้ชัดเจน", "ระบบงานนิ่ง ไม่มีข้อผิดพลาดสำคัญ", "ความสัมพันธ์กับลูกค้า/ทีมแน่นแฟ้น", "ส่งมอบโครงการใหม่ได้ตามแผน"],
  },
  {
    id: "frequent_situation",
    text: "สถานการณ์ที่คนในตำแหน่งนี้เจอบ่อยที่สุดในหนึ่งวันคืออะไร?",
    options: [
      "ลูกค้า/ผู้ใช้ติดต่อเข้ามาตลอด ต้องตอบสนองทันที",
      "เอกสารหรือข้อมูลจำนวนมากที่ต้องตรวจให้ถูกต้อง",
      "ปัญหาเฉพาะหน้าที่ต้องตัดสินใจแก้เอง",
      "งานตามแผนและขั้นตอนที่กำหนดไว้",
    ],
  },
  {
    id: "decision_speed",
    text: "โดยทั่วไปต้องตัดสินใจเร็วแค่ไหน และมีเวลาปรึกษาใครได้บ้าง?",
    options: ["ภายในไม่กี่นาที แทบไม่มีเวลาปรึกษา", "ภายในวันเดียว ปรึกษาได้บ้าง", "มีเวลาเป็นสัปดาห์ ปรึกษาได้เต็มที่"],
  },
  {
    id: "cost_of_error",
    text: "ถ้างานนี้พลาด ความเสียหายที่เกิดขึ้นเป็นแบบไหน และอะไรคือความเสียหายที่ยอมรับไม่ได้?",
    options: ["เสียหายน้อย แก้ไขได้ในวันเดียว", "เสียเงินหรือเสียลูกค้า แต่กู้คืนได้", "เสียหายรุนแรง กู้คืนยาก หรือผิดกฎระเบียบ"],
  },
  {
    id: "routine_vs_initiative",
    text: "งานนี้ต้องทำตามขั้นตอนที่กำหนด หรือต้องริเริ่มวิธีเองมากกว่ากัน?",
    options: ["ตามขั้นตอนเป็นหลัก (≥70%)", "ผสมกันพอ ๆ กัน", "ริเริ่มเองเป็นหลัก (≥70%)"],
  },
  {
    id: "conflict_speed_vs_error",
    text: "คุณระบุว่าต้องตัดสินใจเร็วมากและความเสียหายเมื่อพลาดรุนแรง แต่ไม่ได้ทำตามขั้นตอนเป็นหลัก — ในทางปฏิบัติมีกลไกตรวจทานหรือคนช่วยเช็กก่อนลงมือหรือไม่? ถ้าไม่มี องค์กรยอมรับความเสี่ยงด้านไหนมากกว่ากัน: ช้าลงเล็กน้อย หรือพลาดบ้าง?",
    options: ["มีกลไกตรวจทาน/คนช่วยเช็ก", "ไม่มี — ยอมช้าลงเล็กน้อยดีกว่า", "ไม่มี — ยอมรับความพลาดบ้างเพื่อความเร็ว"],
    when: (a) =>
      a.decision_speed?.startsWith("ภายในไม่กี่นาที") === true &&
      a.cost_of_error?.startsWith("เสียหายรุนแรง") === true &&
      !a.routine_vs_initiative?.startsWith("ตามขั้นตอน"),
  },
  {
    id: "interaction_mix",
    text: "ในงานนี้ ส่วนไหนกินเวลามากที่สุด: โน้มน้าวให้คนตัดสินใจ, ประสานงาน/ดูแลความสัมพันธ์, ดูแลลูกค้าเดิม, หรือตรวจข้อมูล?",
    options: ["โน้มน้าวให้คนตัดสินใจ", "ประสานงานและดูแลความสัมพันธ์", "ดูแลลูกค้าเดิมอย่างต่อเนื่อง", "ตรวจและวิเคราะห์ข้อมูล", "สมดุลกันทุกด้าน"],
  },
  {
    id: "routine_change_ratio",
    text: "สัดส่วนระหว่างงานประจำที่ทำซ้ำ กับงานที่เปลี่ยนไปเรื่อย ๆ เป็นอย่างไร?",
    options: ["งานประจำเป็นส่วนใหญ่ (≥70%)", "ครึ่งต่อครึ่ง", "งานเปลี่ยนตลอดเป็นส่วนใหญ่ (≥70%)"],
  },
  {
    id: "authority",
    text: "คนในตำแหน่งนี้มีอำนาจตัดสินใจระดับไหน?",
    options: ["ต้องขออนุมัติเกือบทุกเรื่อง", "ตัดสินใจได้ในกรอบที่กำหนด", "ตัดสินใจได้เองเกือบทั้งหมด"],
  },
  {
    id: "tradeoff_deadline",
    text: "สถานการณ์จริง: ต้องส่งงานภายในวันนี้ แต่ข้อมูลยังไม่ครบ งานนี้ควรทำอย่างไร?",
    options: ["ส่งก่อนพร้อมระบุข้อจำกัดชัดเจน", "ส่งเฉพาะส่วนที่ยืนยันแล้ว ส่วนที่เหลือตามมา", "ขอเลื่อนจนกว่าข้อมูลครบ เพราะความถูกต้องสำคัญกว่า"],
  },
  {
    id: "manager_team",
    text: "หัวหน้าและทีมทำงานกันอย่างไร และองค์กรปรับวิธีทำงานหรือสนับสนุนคนใหม่ได้แค่ไหน? (เลือกข้อที่ใกล้เคียง แล้วพิมพ์เพิ่มได้)",
    options: ["หัวหน้าลงรายละเอียด ติดตามใกล้ชิด", "หัวหน้าให้อิสระ ดูที่ผลลัพธ์", "ทีมกระจาย/ทำงานทางไกล สื่อสารผ่านข้อความเป็นหลัก"],
  },
  {
    id: "skills_separate",
    text: "ทักษะหรือประสบการณ์อะไรที่ต้องตรวจแยกจากแบบประเมินพฤติกรรมนี้ (เช่น ภาษา เครื่องมือ ใบอนุญาต ประสบการณ์เฉพาะ)? พิมพ์ได้เลย",
    options: ["ไม่มีเป็นพิเศษ"],
  },
];

/** จับคู่คำตอบของผู้รับสมัครกับคำถามตามลำดับที่ถาม (เฉพาะคำถามที่ถูกถามจริง) */
export function demoCollectAnswers(transcript: TranscriptMessage[]): { answers: Record<string, string>; asked: string[] } {
  const answers: Record<string, string> = {};
  const asked: string[] = [];
  let pendingId: string | null = null;
  for (const m of transcript) {
    if (m.sender === "ai") {
      const match = /\[q:([a-z_0-9]+)\]/.exec(m.content);
      pendingId = match ? match[1] : null;
      if (pendingId && !asked.includes(pendingId)) asked.push(pendingId);
    } else if (m.sender === "recruiter" && pendingId) {
      answers[pendingId] = m.content.trim();
      pendingId = null;
    }
  }
  return { answers, asked };
}

function nextQuestion(answers: Record<string, string>): ScriptQuestion | null {
  for (const q of DEMO_SCRIPT) {
    if (answers[q.id] !== undefined) continue;
    if (q.when && !q.when(answers)) continue;
    return q;
  }
  return null;
}

type Range = { min: number; max: number; weight: number; evidence: string[]; reasons: string[] };

function baseRanges(): Record<AxisKey, Range> {
  const out = {} as Record<AxisKey, Range>;
  for (const k of AXES) out[k] = { min: 30, max: 70, weight: 1, evidence: [], reasons: [] };
  return out;
}

function adj(r: Range, min: number, max: number, weightDelta: number, evidence: string, reason: string) {
  r.min = Math.max(0, Math.min(100, min));
  r.max = Math.max(r.min, Math.min(100, max));
  r.weight = Math.max(0, Math.round((r.weight + weightDelta) * 10) / 10);
  r.evidence.push(evidence);
  r.reasons.push(reason);
}

/** สร้างโปรไฟล์จากคำตอบอย่างโปร่งใส: ทุกการปรับอ้างอิงคำตอบจริง ไม่อ้างชื่อตำแหน่ง */
export function demoBuildProfile(input: DiscoveryInput, answers: Record<string, string>): AiRoleProfile {
  const R = baseRanges();
  const assumptions: string[] = [
    "โปรไฟล์นี้สร้างโดย Demo adapter (กฎที่กำหนดไว้ล่วงหน้า) ไม่ใช่ AI จริง",
    "ช่วงเริ่มต้นทุกแกนคือ 30–70 น้ำหนัก 1 แล้วปรับตามคำตอบเท่านั้น ไม่ได้อนุมานจากชื่อตำแหน่ง",
  ];
  const unresolved: string[] = [];
  const ev = (id: string) => `คำตอบข้อ "${id}": ${answers[id]}`;

  const fs = answers.frequent_situation ?? "";
  if (fs.startsWith("ลูกค้า")) {
    adj(R.I, 50, 85, 1, ev("frequent_situation"), "ต้องตอบสนองลูกค้าต่อเนื่อง จึงเพิ่มช่วงด้านการสื่อสาร");
    adj(R.iS, 45, 80, 0.5, ev("frequent_situation"), "ต้องดูแลผู้ติดต่อ จึงเพิ่มด้านความสัมพันธ์");
  } else if (fs.startsWith("เอกสาร")) {
    adj(R.C, 55, 90, 1, ev("frequent_situation"), "งานตรวจข้อมูลจำนวนมาก");
    adj(R.SC, 50, 85, 0.5, ev("frequent_situation"), "ต้องติดตามเอกสารเป็นระบบ");
  } else if (fs.startsWith("ปัญหาเฉพาะหน้า")) {
    adj(R.D, 50, 85, 1, ev("frequent_situation"), "ต้องตัดสินใจแก้ปัญหาเอง");
    adj(R.Di, 40, 75, 0.5, ev("frequent_situation"), "ต้องริเริ่มทางแก้");
  } else if (fs.startsWith("งานตามแผน")) {
    adj(R.SC, 55, 90, 1, ev("frequent_situation"), "ทำตามแผนและขั้นตอน");
    adj(R.S, 50, 85, 0.5, ev("frequent_situation"), "ต้องรักษาจังหวะงานสม่ำเสมอ");
  } else if (fs) unresolved.push(`สถานการณ์ที่เจอบ่อยระบุเป็นข้อความอิสระ ("${fs.slice(0, 80)}") ยังไม่ได้แปลงเป็นช่วงเป้าหมาย`);

  const ds = answers.decision_speed ?? "";
  if (ds.startsWith("ภายในไม่กี่นาที")) adj(R.D, Math.max(R.D.min, 55), Math.max(R.D.max, 85), 0.5, ev("decision_speed"), "ต้องตัดสินใจเร็วมาก");
  else if (ds.startsWith("มีเวลาเป็นสัปดาห์")) adj(R.C, Math.max(R.C.min, 40), Math.max(R.C.max, 80), 0.5, ev("decision_speed"), "มีเวลาวิเคราะห์ก่อนตัดสินใจ");

  const ce = answers.cost_of_error ?? "";
  if (ce.startsWith("เสียหายรุนแรง")) {
    adj(R.C, Math.max(R.C.min, 60), 95, 1, ev("cost_of_error"), "ความผิดพลาดมีต้นทุนสูง");
    adj(R.CD, 45, 80, 0.5, ev("cost_of_error"), "ต้องตั้งคำถามและตรวจคุณภาพก่อนปล่อยงาน");
  } else if (ce.startsWith("เสียหายน้อย")) {
    adj(R.C, 20, 65, 0, ev("cost_of_error"), "ความผิดพลาดแก้ไขได้ง่าย ไม่ต้องเจาะจงด้านความละเอียดมาก");
  }

  const ri = answers.routine_vs_initiative ?? "";
  if (ri.startsWith("ตามขั้นตอน")) {
    adj(R.SC, Math.max(R.SC.min, 55), 90, 1, ev("routine_vs_initiative"), "ทำตามขั้นตอนเป็นหลัก");
    adj(R.Di, 15, 55, 0.5, ev("routine_vs_initiative"), "งานไม่ต้องการการริเริ่มเปลี่ยนแปลงมาก");
  } else if (ri.startsWith("ริเริ่มเอง")) {
    adj(R.Di, 55, 90, 1, ev("routine_vs_initiative"), "ต้องริเริ่มวิธีเอง");
    adj(R.SC, 25, 65, 0, ev("routine_vs_initiative"), "ขั้นตอนตายตัวมีน้อย");
  }

  const cf = answers.conflict_speed_vs_error ?? "";
  if (cf.startsWith("มีกลไก")) assumptions.push("องค์กรระบุว่ามีกลไกตรวจทาน จึงไม่ดันช่วง C ขึ้นสุดโต่ง");
  else if (cf.startsWith("ไม่มี — ยอมช้าลง")) adj(R.C, Math.max(R.C.min, 65), 95, 0.5, ev("conflict_speed_vs_error"), "องค์กรเลือกความถูกต้องก่อนความเร็ว");
  else if (cf.startsWith("ไม่มี — ยอมรับความพลาด")) adj(R.D, Math.max(R.D.min, 60), 90, 0.5, ev("conflict_speed_vs_error"), "องค์กรเลือกความเร็วก่อน");

  const im = answers.interaction_mix ?? "";
  if (im.startsWith("โน้มน้าว")) {
    adj(R.Di, Math.max(R.Di.min, 55), 90, 1, ev("interaction_mix"), "งานหลักคือโน้มน้าวให้คนตัดสินใจ");
    adj(R.I, Math.max(R.I.min, 45), 85, 0.5, ev("interaction_mix"), "ต้องสื่อสารเชิงรุก");
  } else if (im.startsWith("ประสานงาน")) {
    adj(R.iS, Math.max(R.iS.min, 55), 90, 1, ev("interaction_mix"), "งานหลักคือประสานและดูแลความสัมพันธ์");
  } else if (im.startsWith("ดูแลลูกค้าเดิม")) {
    adj(R.iS, Math.max(R.iS.min, 50), 85, 1, ev("interaction_mix"), "ดูแลลูกค้าเดิมต่อเนื่อง");
    adj(R.S, Math.max(R.S.min, 45), 85, 0.5, ev("interaction_mix"), "ต้องสม่ำเสมอ");
  } else if (im.startsWith("ตรวจและวิเคราะห์")) {
    adj(R.C, Math.max(R.C.min, 60), 95, 1, ev("interaction_mix"), "งานหลักคือตรวจและวิเคราะห์ข้อมูล");
  }

  const rc = answers.routine_change_ratio ?? "";
  if (rc.startsWith("งานประจำ")) adj(R.S, Math.max(R.S.min, 55), 90, 1, ev("routine_change_ratio"), "งานประจำเป็นส่วนใหญ่");
  else if (rc.startsWith("งานเปลี่ยนตลอด")) {
    adj(R.S, 15, 60, 0.5, ev("routine_change_ratio"), "งานเปลี่ยนตลอด ความชอบงานซ้ำไม่จำเป็น");
    adj(R.Di, Math.max(R.Di.min, 45), 85, 0.5, ev("routine_change_ratio"), "ต้องรับมือการเปลี่ยนแปลง");
  }

  const au = answers.authority ?? "";
  if (au.startsWith("ตัดสินใจได้เอง")) adj(R.D, Math.max(R.D.min, 50), 90, 0.5, ev("authority"), "มีอำนาจตัดสินใจเองสูง");
  else if (au.startsWith("ต้องขออนุมัติ")) adj(R.D, 20, 65, 0, ev("authority"), "อำนาจตัดสินใจจำกัด");

  const td = answers.tradeoff_deadline ?? "";
  if (td.startsWith("ส่งก่อน")) adj(R.D, Math.max(R.D.min, 45), Math.max(R.D.max, 80), 0, ev("tradeoff_deadline"), "องค์กรยอมรับการส่งก่อนพร้อมระบุข้อจำกัด");
  else if (td.startsWith("ขอเลื่อน")) adj(R.C, Math.max(R.C.min, 55), Math.max(R.C.max, 90), 0.5, ev("tradeoff_deadline"), "องค์กรให้ความถูกต้องมาก่อนกำหนดเวลา");

  const mt = answers.manager_team ?? "";
  if (mt.startsWith("หัวหน้าลงรายละเอียด")) assumptions.push("หัวหน้าติดตามใกล้ชิด: ความต้องการนี้เป็นสไตล์ของหัวหน้า ไม่ได้แปลงเป็นช่วงเป้าหมาย ควรคุยเรื่องการปรับตัวทั้งสองฝ่าย");
  if (mt.startsWith("ทีมกระจาย")) adj(R.SC, Math.max(R.SC.min, 45), Math.max(R.SC.max, 85), 0.5, ev("manager_team"), "ทำงานทางไกลต้องติดตามงานด้วยตนเองมากขึ้น");

  const skillsText = answers.skills_separate && !answers.skills_separate.startsWith("ไม่มี") ? answers.skills_separate : "";
  for (const q of DEMO_SCRIPT) {
    if (answers[q.id] === undefined && (!q.when || q.when(answers))) unresolved.push(`ยังไม่ได้ถาม: ${q.text}`);
  }

  const axes = Object.fromEntries(
    AXES.map((k) => [
      k,
      {
        targetMin: R[k].min,
        targetMax: R[k].max,
        weight: R[k].weight,
        rationale:
          R[k].reasons.length > 0
            ? R[k].reasons.join("; ")
            : "ไม่มีคำตอบที่ชี้ถึงแกนนี้โดยตรง จึงใช้ช่วงกว้างและน้ำหนักพื้นฐาน",
        evidenceFromConversation: R[k].evidence,
      },
    ]),
  ) as AiRoleProfile["axes"];

  return {
    roleTitle: input.roleTitle,
    level: answers.level_duties?.split(/[\n,]/)[0]?.trim() || input.level || "",
    responsibilities: answers.level_duties ? [answers.level_duties] : [],
    successOutcomes: answers.outcome_90 ? [answers.outcome_90] : [],
    workContext: {
      decisionSpeed: ds,
      costOfError: ce,
      routineVsChange: [ri, rc].filter(Boolean).join(" / "),
      authorityLevel: au,
      teamAndManagerStyle: mt,
      supportAvailable: mt,
      frequentSituations: fs ? [fs] : [],
    },
    requiredSkills: skillsText ? skillsText.split(/[,\n、;]/).map((s) => s.trim()).filter(Boolean) : [],
    unresolvedQuestions: unresolved,
    axes,
    assumptions,
  };
}

const MIN_TURNS_BEFORE_READY = 8;

export class DemoAdapter implements AIAdapter {
  readonly provider = "demo" as const;
  readonly model = "scripted-demo-v1";

  async discoveryTurn(input: DiscoveryInput): Promise<AIResult<DiscoveryTurn>> {
    const { answers } = demoCollectAnswers(input.transcript);
    const answeredCount = Object.keys(answers).length;
    const lastRecruiter = [...input.transcript].reverse().find((m) => m.sender === "recruiter")?.content ?? "";
    const wantsSummary = /สรุป|พอแล้ว|ready|summary/i.test(lastRecruiter) && answeredCount >= 4;
    const q = nextQuestion(answers);

    const conflicts: string[] = [];
    if (DEMO_SCRIPT.find((s) => s.id === "conflict_speed_vs_error")!.when!(answers)) {
      conflicts.push("ต้องตัดสินใจเร็วมาก + ความเสียหายรุนแรง + ไม่ได้ทำตามขั้นตอนเป็นหลัก — ควรยืนยัน trade-off");
    }

    if (q && !wantsSummary) {
      const intro =
        answeredCount === 0
          ? "สวัสดีครับ (Demo mode: บทสนทนานี้เป็นสคริปต์ที่กำหนดไว้ล่วงหน้า ไม่ใช่ AI จริง) ผมจะถามทีละข้อเพื่อทำความเข้าใจงานนี้ โดยไม่อนุมานจากชื่อตำแหน่ง"
          : `รับทราบครับ (${answeredCount}/${DEMO_SCRIPT.length - 1} ข้อ)`;
      const content: DiscoveryTurn = {
        assistantMessage: `${intro} [q:${q.id}]`,
        questions: [{ id: q.id, text: q.text, options: q.options }],
        phase: "asking",
        conflictsNoticed: conflicts,
        knownGaps: DEMO_SCRIPT.filter((s) => answers[s.id] === undefined && (!s.when || s.when(answers))).map((s) => s.id),
        proposedProfile: null,
      };
      return { provider: this.provider, model: this.model, content: DiscoveryTurnSchema.parse(content) };
    }

    const profile = demoBuildProfile(input, answers);
    const gaps = profile.unresolvedQuestions;
    const content: DiscoveryTurn = {
      assistantMessage:
        answeredCount >= MIN_TURNS_BEFORE_READY
          ? "ข้อมูลเพียงพอสำหรับร่างโปรไฟล์เป้าหมายแล้ว (Demo mode: สร้างจากกฎที่กำหนดไว้ ไม่ใช่ AI จริง) กรุณาตรวจและปรับช่วง/น้ำหนักก่อนยืนยัน"
          : "สรุปตามที่ขอ แต่ข้อมูลยังไม่ครบ ช่วงที่ไม่มีหลักฐานจะกว้างและมีรายการสิ่งที่ยังไม่ทราบ (Demo mode)",
      questions: [],
      phase: "ready",
      conflictsNoticed: conflicts,
      knownGaps: gaps,
      proposedProfile: profile,
    };
    return { provider: this.provider, model: this.model, content: DiscoveryTurnSchema.parse(content) };
  }

  async candidateReport(input: ReportInput): Promise<AIResult<CandidateReport>> {
    const s = input.scaleScores;
    const sorted = [...AXES].sort((a, b) => s[b] - s[a]);
    const tendencies = AXES.map((k) => ({
      axis: k,
      text:
        s[k] >= 65
          ? `${AXIS_DEFINITIONS[k].nameTh} (${s[k]}): จากคำตอบที่รายงาน ${AXIS_DEFINITIONS[k].highTendency}`
          : s[k] <= 35
            ? `${AXIS_DEFINITIONS[k].nameTh} (${s[k]}): จากคำตอบที่รายงาน ${AXIS_DEFINITIONS[k].lowTendency}`
            : `${AXIS_DEFINITIONS[k].nameTh} (${s[k]}): คำตอบอยู่ช่วงกลาง อาจปรับพฤติกรรมตามสถานการณ์`,
    }));
    const content: CandidateReport = {
      summary: `(Demo mode — ข้อความนี้สร้างจากแม่แบบ ไม่ใช่ AI จริง) จากคำตอบที่คุณรายงาน แกนที่คุณให้คะแนนตนเองสูงกว่าแกนอื่นคือ ${AXIS_DEFINITIONS[sorted[0]].nameTh} และ ${AXIS_DEFINITIONS[sorted[1]].nameTh} ส่วนแกนที่ให้คะแนนต่ำกว่าคือ ${AXIS_DEFINITIONS[sorted[7]].nameTh} คะแนนเหล่านี้สะท้อนสิ่งที่คุณเลือกตอบในช่วง 6 เดือนที่ผ่านมา ไม่ใช่ความสามารถหรือคุณค่าของคุณ`,
      tendencies,
      possibleStrengths: sorted.slice(0, 3).map((k) => `อาจใช้ประโยชน์จากแนวโน้มด้าน${AXIS_DEFINITIONS[k].nameTh}ได้ในงานที่ต้องการสิ่งนี้ (คะแนนที่รายงาน ${s[k]})`),
      situationsToAdapt: sorted.slice(5).map((k) => `สถานการณ์ที่ต้องการ${AXIS_DEFINITIONS[k].nameTh}มาก อาจต้องใช้ความพยายามปรับวิธีทำงานเพิ่ม (คะแนนที่รายงาน ${s[k]}) — ควรตรวจสอบกับประสบการณ์จริงของคุณ`),
      communicationTips: [
        `บอกทีมล่วงหน้าว่าคุณถนัดสไตล์ที่เน้น${AXIS_DEFINITIONS[sorted[0]].nameTh} และต้องการอะไรจากคนอื่นในด้าน${AXIS_DEFINITIONS[sorted[7]].nameTh}`,
        "ขอ feedback เป็นระยะว่าพฤติกรรมที่คุณรายงานตรงกับที่เพื่อนร่วมงานสังเกตเห็นหรือไม่",
      ],
      selfDevelopmentIdeas: sorted.slice(6).map((k) => `หากงานต้องการด้าน${AXIS_DEFINITIONS[k].nameTh} อาจทดลองฝึกพฤติกรรมเล็ก ๆ เช่น "${AXIS_DEFINITIONS[k].highTendency}" ในสถานการณ์ที่ปลอดภัยก่อน`),
      dataLimitations: [
        "คะแนนมาจากการรายงานตนเอง 64 ข้อ ยังไม่ผ่าน psychometric validation",
        "ไม่ได้วัดทักษะ ประสบการณ์ ความฉลาด หรือสุขภาพจิต",
        input.responseQuality.notes.length > 0 ? `ข้อสังเกตเรื่องการตอบ: ${input.responseQuality.notes.join("; ")}` : "ไม่มีข้อสังเกตพิเศษเรื่องรูปแบบการตอบ",
      ],
    };
    return { provider: this.provider, model: this.model, content: CandidateReportSchema.parse(content) };
  }

  async organizationReport(input: ReportInput): Promise<AIResult<OrganizationReport>> {
    const s = input.scaleScores;
    const al = input.alignment;
    const p = input.profile;
    const byDistance = al ? [...al.axes].sort((a, b) => b.distance * b.weight - a.distance * a.weight) : [];
    const within = al ? al.axes.filter((a) => a.position === "within" && a.weight > 0) : [];
    const off = byDistance.filter((a) => a.distance > 0 && a.weight > 0);
    const name = (k: AxisKey) => AXIS_DEFINITIONS[k].nameTh;
    const situations = p.workContext.frequentSituations[0] ?? p.responsibilities[0] ?? "งานประจำวันของตำแหน่งนี้";

    const questionTemplates: Record<AxisKey, string> = {
      D: `เล่าสถานการณ์ล่าสุดที่คุณต้องตัดสินใจทั้งที่ข้อมูลไม่ครบ ใน${situations} คุณตัดสินใจอย่างไรและผลเป็นอย่างไร`,
      Di: `ครั้งล่าสุดที่คุณเสนอให้เปลี่ยนวิธีทำงานคืออะไร คุณทำอย่างไรให้คนอื่นยอมลอง และถ้าไม่สำเร็จคุณทำอย่างไร`,
      I: `ใน${situations} คุณสื่อสารกับคนที่ไม่คุ้นเคยอย่างไร ยกตัวอย่างที่คุณต้องสร้างบรรยากาศหรือดึงความสนใจ`,
      iS: `เล่าเหตุการณ์ที่เพื่อนร่วมงานมีปัญหาและคุณต้องเลือกระหว่างงานตัวเองกับการช่วยเขา คุณตัดสินใจอย่างไร`,
      S: `งานนี้มีส่วนที่ต้องทำซ้ำสม่ำเสมอ (${p.workContext.routineVsChange || "ตามที่ระบุ"}) คุณรักษาคุณภาพในงานซ้ำได้อย่างไรในอดีต`,
      SC: `เล่าวิธีที่คุณติดตามงานค้างหลายรายการพร้อมกันครั้งล่าสุด ใช้เครื่องมืออะไร และเคยพลาดอะไรบ้าง`,
      C: `ความเสียหายเมื่อพลาดของงานนี้คือ "${p.workContext.costOfError || "ตามที่ระบุ"}" เล่าครั้งที่คุณพบข้อผิดพลาดก่อนส่งงาน คุณพบได้อย่างไร`,
      CD: `เล่าครั้งที่คุณไม่เห็นด้วยกับแผนที่ทุกคนเห็นชอบแล้ว คุณตั้งคำถามอย่างไรและผลเป็นอย่างไร`,
    };
    const askAxes = (off.length > 0 ? off.map((a) => a.axis) : [...AXES]).slice(0, 5);
    while (askAxes.length < 5) {
      const next = AXES.find((k) => !askAxes.includes(k));
      if (!next) break;
      askAxes.push(next);
    }

    const content: OrganizationReport = {
      summary: al
        ? `(Demo mode — สร้างจากแม่แบบ ไม่ใช่ AI จริง) ดัชนีความสอดคล้องด้านพฤติกรรมกับบทบาท ${al.overall}% คำนวณจากระยะห่างระหว่างคะแนนที่ผู้สมัครรายงานกับช่วงเป้าหมายที่องค์กรกำหนด ไม่ใช่โอกาสทำงานสำเร็จ แกนที่อยู่ในช่วง: ${within.map((a) => name(a.axis)).join(", ") || "ไม่มี"}; แกนที่ต่างจากช่วง: ${off.map((a) => `${name(a.axis)} (${a.position === "below" ? "ต่ำกว่า" : "สูงกว่า"} ${a.distance} จุด)`).join(", ") || "ไม่มี"}`
        : "(Demo mode) ไม่มีดัชนีความสอดคล้องเพราะไม่มีโปรไฟล์เป้าหมายที่ยืนยันแล้วหรือข้อมูลไม่สมบูรณ์",
      alignmentPoints: within.map((a) => `${name(a.axis)}: คะแนนที่รายงาน ${s[a.axis]} อยู่ในช่วง ${a.targetMin}–${a.targetMax} ที่องค์กรกำหนด (เหตุผลของช่วง: ${p.axes[a.axis].rationale})`),
      differencesToExplore: off.map((a) => `${name(a.axis)}: คะแนนที่รายงาน ${s[a.axis]} ${a.position === "below" ? "ต่ำกว่า" : "สูงกว่า"}ช่วง ${a.targetMin}–${a.targetMax} อยู่ ${a.distance} จุด (น้ำหนัก ${a.weight}) ควรสอบถามว่าในบริบทงานจริงผู้สมัครปรับพฤติกรรมนี้อย่างไร`),
      interviewQuestions: askAxes.map((k) => ({
        question: questionTemplates[k],
        linkedAxis: k,
        whyThis: al?.axes.find((a) => a.axis === k)?.distance
          ? `คะแนนที่รายงานต่างจากช่วงเป้าหมายของแกนนี้ จึงควรตรวจสอบด้วยตัวอย่างเหตุการณ์จริง`
          : `แกนนี้เกี่ยวข้องกับงานตามโปรไฟล์ที่องค์กรยืนยัน`,
      })),
      workSampleIdeas: [
        ...(p.requiredSkills.length > 0
          ? p.requiredSkills.slice(0, 3).map((sk) => `แบบทดสอบงานจริงสำหรับทักษะ "${sk}" ซึ่งแบบประเมินพฤติกรรมนี้ไม่ได้วัด`)
          : ["กำหนดชิ้นงานตัวอย่างที่สะท้อนหน้าที่หลัก เพื่อตรวจทักษะและประสบการณ์แยกจากพฤติกรรมที่รายงาน"]),
        `จำลองสถานการณ์ "${situations}" ให้ผู้สมัครอธิบายขั้นตอนที่จะทำและเหตุผล`,
      ],
      managerAdjustments: [
        p.workContext.teamAndManagerStyle
          ? `สไตล์หัวหน้า/ทีมที่ระบุคือ "${p.workContext.teamAndManagerStyle}" ควรคุยกับผู้สมัครตรง ๆ ว่าคาดหวังการสื่อสารแบบใด แทนการคาดหวังให้ผู้สมัครเหมือนหัวหน้า`
          : "ยังไม่มีข้อมูลสไตล์หัวหน้า ควรเพิ่มในโปรไฟล์",
        ...off.slice(0, 2).map((a) => `หากรับผู้สมัครรายนี้ หัวหน้าอาจต้องปรับวิธีสนับสนุนด้าน${name(a.axis)} เช่น ตกลงกติกาและจุดตรวจร่วมกันตั้งแต่ต้น`),
      ],
      candidateAdjustments: off.slice(0, 3).map((a) => `ผู้สมัครอาจฝึกพฤติกรรมด้าน${name(a.axis)}ให้เข้ากับงาน (${a.position === "below" ? AXIS_DEFINITIONS[a.axis].highTendency : AXIS_DEFINITIONS[a.axis].lowTendency}) ควรตรวจสอบกับผู้สมัครว่าสนใจและทำได้จริงหรือไม่`),
      onboardingPlan30Days: [
        { period: "วันที่ 1–7", focus: ["ชี้แจงความคาดหวังและผลลัพธ์ 90 วันอย่างชัดเจน", `ตกลงวิธีสื่อสารกับหัวหน้า (${p.workContext.teamAndManagerStyle || "ตามที่ตกลง"})`] },
        { period: "วันที่ 8–14", focus: [`มอบหมายงานตัวอย่างใน "${situations}" พร้อมคนช่วยตรวจทาน`, ...off.slice(0, 1).map((a) => `สังเกตและพูดคุยเรื่องด้าน${name(a.axis)}ในงานจริง`)] },
        { period: "วันที่ 15–30", focus: ["ทบทวนร่วมกันว่าพฤติกรรมที่รายงานตรงกับที่สังเกตเห็นหรือไม่", "ปรับแผนสนับสนุนตามข้อมูลจริง ไม่ยึดคะแนนจากแบบประเมิน"] },
      ],
      cautions: [
        "คะแนนและดัชนีนี้เป็น heuristic ของต้นแบบ ยังไม่ผ่าน psychometric validation ห้ามใช้ตัดสินรับ/ปฏิเสธโดยอัตโนมัติ",
        "ช่วงเป้าหมายที่กว้างและน้ำหนักที่ต่างกันทำให้ดัชนีรวมเปลี่ยนได้ ควรเปิดดูรายละเอียดการคำนวณ",
        ...(input.responseQuality.notes.length > 0 ? [`ข้อสังเกตเรื่องการตอบ (ไม่ใช่ข้อสรุปเรื่องความซื่อสัตย์): ${input.responseQuality.notes.join("; ")}`] : []),
      ],
    };
    return { provider: this.provider, model: this.model, content: OrganizationReportSchema.parse(content) };
  }
}

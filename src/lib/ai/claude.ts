import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { ParsedMessage } from "@anthropic-ai/sdk/lib/parser";
import { env } from "@/lib/env";
import { AXES } from "@/lib/model/axes";
import {
  CandidateReportSchema,
  DiscoveryTurnSchema,
  OrganizationReportSchema,
  type CandidateReport,
  type DiscoveryTurn,
  type OrganizationReport,
} from "./schemas";
import { DISCOVERY_SYSTEM_PROMPT, REPORT_SYSTEM_PROMPT, wrapUntrusted } from "./prompts";
import { AIError, type AIAdapter, type AIResult, type DiscoveryInput, type ReportInput } from "./types";

/**
 * Claude adapter — เรียกจาก server เท่านั้น
 * - model ตั้งผ่าน ANTHROPIC_MODEL (ไม่ hardcode)
 * - ใช้ structured output (output_config.format) + zod validation ทุกครั้ง
 * - timeout และ retry จำกัด; ผิด schema → AIError("schema")
 */
export class ClaudeAdapter implements AIAdapter {
  readonly provider = "claude" as const;
  readonly model: string;
  private client: Anthropic;

  constructor(opts?: { apiKey?: string; model?: string; timeoutMs?: number; baseURL?: string }) {
    const apiKey = opts?.apiKey ?? env.anthropicApiKey;
    const model = opts?.model ?? env.anthropicModel;
    if (!apiKey) throw new AIError("ANTHROPIC_API_KEY ยังไม่ได้ตั้งค่า", "config");
    if (!model) throw new AIError("ANTHROPIC_MODEL ยังไม่ได้ตั้งค่า", "config");
    this.model = model;
    this.client = new Anthropic({
      apiKey,
      baseURL: opts?.baseURL,
      timeout: opts?.timeoutMs ?? env.aiTimeoutMs,
      maxRetries: 1,
    });
  }

  private async parseJson<S extends z.ZodType>(
    system: string,
    user: string,
    schema: S,
    maxTokens: number,
  ): Promise<z.infer<S>> {
    let response: ParsedMessage<z.infer<S>>;
    try {
      response = await this.client.messages.parse({
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
        output_config: { format: zodOutputFormat(schema) },
      });
    } catch (e) {
      if (e instanceof Anthropic.APIConnectionTimeoutError) throw new AIError("AI ตอบช้าเกินกำหนด", "timeout", e);
      if (e instanceof Anthropic.AuthenticationError) throw new AIError("API key ไม่ถูกต้อง", "config", e);
      if (e instanceof Anthropic.RateLimitError) throw new AIError("AI ถูกจำกัดอัตราชั่วคราว", "api", e);
      if (e instanceof Anthropic.APIError) throw new AIError(`AI error (${e.status ?? "?"})`, "api", e);
      // SDK โยน AnthropicError (ไม่ใช่ APIError) เมื่อ parse structured output ไม่ผ่าน schema
      if (e instanceof Anthropic.AnthropicError) throw new AIError("AI ส่งข้อมูลไม่ตรง schema", "schema", e);
      throw new AIError("เรียก AI ไม่สำเร็จ", "api", e);
    }
    if (response.stop_reason === "refusal") throw new AIError("AI ปฏิเสธคำขอนี้", "refusal");
    if (response.stop_reason === "max_tokens") throw new AIError("คำตอบของ AI ยาวเกินกำหนด", "schema");
    const parsed = response.parsed_output;
    if (!parsed) throw new AIError("AI ส่งข้อมูลไม่ตรง schema", "schema");
    const check = schema.safeParse(parsed);
    if (!check.success) throw new AIError("AI ส่งข้อมูลไม่ตรง schema", "schema", check.error);
    return check.data;
  }

  async discoveryTurn(input: DiscoveryInput): Promise<AIResult<DiscoveryTurn>> {
    const transcript = input.transcript
      .map((m) =>
        m.sender === "recruiter"
          ? wrapUntrusted("recruiter_message", m.content)
          : `<assistant_message>\n${m.content}\n</assistant_message>`,
      )
      .join("\n");
    const recruiterTurns = input.transcript.filter((m) => m.sender === "recruiter").length;
    const user = [
      `ตำแหน่งที่กำลังเปิดรับ (ชื่อที่ผู้ใช้กรอก — ใช้เป็นบริบท ห้ามอนุมานโปรไฟล์จากชื่อนี้อย่างเดียว): ${wrapUntrusted("role_title", input.roleTitle)}`,
      input.level ? `ระดับ: ${wrapUntrusted("role_level", input.level)}` : "",
      `จำนวนรอบที่ผู้ใช้ตอบแล้ว: ${recruiterTurns}`,
      "บทสนทนาจนถึงตอนนี้:",
      transcript || "(ยังไม่มี — ให้เริ่มด้วยคำถามแรก)",
      "",
      "โปรดสร้าง turn ถัดไปตาม schema: ถ้ายังต้องถาม ให้ phase = asking และ proposedProfile = null; ถ้าข้อมูลเพียงพอ ให้ phase = ready, questions = [] และใส่ proposedProfile ครบ",
    ]
      .filter(Boolean)
      .join("\n");
    const content = await this.parseJson(DISCOVERY_SYSTEM_PROMPT, user, DiscoveryTurnSchema, 12000);
    return { provider: this.provider, model: this.model, content };
  }

  private reportContext(input: ReportInput): string {
    const rows = AXES.map((k) => {
      const a = input.alignment?.axes.find((x) => x.axis === k);
      const t = input.profile.axes[k];
      return `${k} (${input.axisNames[k]}): คะแนนที่รายงาน=${input.scaleScores[k]}, ช่วงเป้าหมาย=${t.targetMin}–${t.targetMax}, น้ำหนัก=${t.weight}, ระยะห่าง=${a ? a.distance : "-"}, ตำแหน่ง=${a ? a.position : "-"}, เหตุผลของช่วง="${t.rationale}"`;
    }).join("\n");
    const q = input.responseQuality;
    const ctx = [
      `รหัสผู้สมัคร: ${input.candidateCode}`,
      `ตำแหน่ง: ${input.profile.roleTitle} ${input.profile.level}`,
      `หน้าที่หลัก: ${input.profile.responsibilities.join("; ")}`,
      `ผลลัพธ์ที่คาดหวัง: ${input.profile.successOutcomes.join("; ")}`,
      `บริบทงาน: ความเร็วตัดสินใจ=${input.profile.workContext.decisionSpeed}; ความเสียหายเมื่อพลาด=${input.profile.workContext.costOfError}; ประจำ/เปลี่ยน=${input.profile.workContext.routineVsChange}; อำนาจ=${input.profile.workContext.authorityLevel}; หัวหน้า/ทีม=${input.profile.workContext.teamAndManagerStyle}; การสนับสนุน=${input.profile.workContext.supportAvailable}`,
      `สถานการณ์ที่เจอบ่อย: ${input.profile.workContext.frequentSituations.join("; ")}`,
      `ทักษะที่ต้องตรวจแยก: ${input.profile.requiredSkills.join("; ")}`,
      `คะแนนรายแกน (คำนวณด้วยโค้ดแล้ว):\n${rows}`,
      input.alignment
        ? `ดัชนีความสอดคล้องรวม (ตามสูตรของต้นแบบ): ${input.alignment.overall}%`
        : "ดัชนีความสอดคล้องรวม: ไม่มี (ไม่มีโปรไฟล์เป้าหมายหรือยังไม่สมบูรณ์)",
      `คุณภาพการตอบ (ข้อสังเกตเท่านั้น): ครบ=${q.complete}, เวลา=${q.durationSeconds ?? "-"} วินาที, ค่าเดิมติดกันยาวสุด=${q.longestSameValueRun}, สัดส่วนค่าที่ใช้บ่อยสุด=${q.mostFrequentValueShare.toFixed(2)}, ความต่างเฉลี่ยของคู่ข้อ=${q.meanPairDifference ?? "-"}`,
    ].join("\n");
    return wrapUntrusted("context_data", ctx);
  }

  async candidateReport(input: ReportInput): Promise<AIResult<CandidateReport>> {
    const user = `${this.reportContext(input)}\n\nเขียนรายงานสำหรับ "ผู้สมัคร" (เห็นเฉพาะข้อมูลของตนเอง ไม่เห็นช่วงเป้าหมายของงาน ไม่เห็นดัชนีความสอดคล้อง): สรุปแนวโน้มพฤติกรรมจากคำตอบที่รายงาน จุดแข็งที่อาจใช้ประโยชน์ได้ สถานการณ์ที่อาจต้องปรับ คำแนะนำการสื่อสาร และแนวทางพัฒนาตนเอง พร้อม dataLimitations ห้ามกล่าวถึงช่วงเป้าหมายหรือดัชนีความสอดคล้อง`;
    const content = await this.parseJson(REPORT_SYSTEM_PROMPT, user, CandidateReportSchema, 8000);
    return { provider: this.provider, model: this.model, content };
  }

  async organizationReport(input: ReportInput): Promise<AIResult<OrganizationReport>> {
    const user = `${this.reportContext(input)}\n\nเขียนรายงานสำหรับ "องค์กร": จุดสอดคล้องกับงาน ความต่างที่ควรถามเพิ่ม คำถามสัมภาษณ์ 5 ข้อที่โยงกับงานจริง (interviewQuestions ต้องมี 5 รายการ) ตัวอย่าง work sample เพื่อตรวจทักษะแยก แนวทางที่หัวหน้าควรปรับ แนวทางที่ผู้สมัครอาจฝึก แผน onboarding 30 วัน (แบ่งเป็นช่วง) และ cautions เรื่องข้อจำกัดของข้อมูล`;
    const content = await this.parseJson(REPORT_SYSTEM_PROMPT, user, OrganizationReportSchema, 10000);
    return { provider: this.provider, model: this.model, content };
  }
}

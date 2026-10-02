import type { AxisKey } from "@/lib/model/axes";
import type { RoleProfile } from "@/lib/model/roleProfile";
import type { AlignmentResult, ResponseQuality, ScaleScores } from "@/lib/scoring";
import type { CandidateReport, DiscoveryTurn, OrganizationReport } from "./schemas";

export type AiProvider = "claude" | "demo";

export interface TranscriptMessage {
  sender: "ai" | "recruiter" | "system";
  content: string;
}

export interface DiscoveryInput {
  roleTitle: string;
  level: string;
  /** บทสนทนาทั้งหมดจนถึงตอนนี้ (ข้อความล่าสุดคือคำตอบของผู้รับสมัคร) */
  transcript: TranscriptMessage[];
}

export interface ReportInput {
  roleTitle: string;
  /** รหัสผู้สมัคร (ไม่ส่งชื่อ/อีเมลให้ AI) */
  candidateCode: string;
  profile: RoleProfile;
  scaleScores: ScaleScores;
  alignment: AlignmentResult | null;
  responseQuality: ResponseQuality;
  axisNames: Record<AxisKey, string>;
}

export interface AIResult<T> {
  provider: AiProvider;
  model: string;
  content: T;
}

export interface AIAdapter {
  readonly provider: AiProvider;
  readonly model: string;
  discoveryTurn(input: DiscoveryInput): Promise<AIResult<DiscoveryTurn>>;
  candidateReport(input: ReportInput): Promise<AIResult<CandidateReport>>;
  organizationReport(input: ReportInput): Promise<AIResult<OrganizationReport>>;
}

export class AIError extends Error {
  constructor(
    message: string,
    public readonly code: "timeout" | "schema" | "api" | "config" | "refusal",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AIError";
  }
}

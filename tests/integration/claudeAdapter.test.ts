import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { ClaudeAdapter } from "@/lib/ai/claude";
import { AIError } from "@/lib/ai/types";
import { profileWith } from "./helpers";
import { AXES } from "@/lib/model/axes";

/**
 * จำลอง Anthropic API ด้วย http server ในเครื่อง เพื่อทดสอบว่า adapter จัดการ
 * JSON ผิด schema, timeout และ refusal ได้โดยไม่ล้ม และไม่ยอมรับข้อมูลผิดรูป
 */
let server: http.Server;
let baseURL: string;
let mode: "bad_schema" | "slow" | "good" | "refusal" = "bad_schema";

function textMessage(text: string, stop = "end_turn") {
  return JSON.stringify({
    id: "msg_test", type: "message", role: "assistant", model: "test", stop_reason: stop, stop_sequence: null,
    content: text === "" ? [] : [{ type: "text", text }], usage: { input_tokens: 1, output_tokens: 1 },
  });
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("content-type", "application/json");
      if (mode === "slow") {
        setTimeout(() => res.end(textMessage("{}")), 3000);
        return;
      }
      if (mode === "bad_schema") return res.end(textMessage(JSON.stringify({ assistantMessage: 123, nope: true })));
      if (mode === "refusal") return res.end(textMessage("", "refusal"));
      const good = {
        summary: "สรุป", tendencies: [], possibleStrengths: ["อาจ..."], situationsToAdapt: [], communicationTips: [], selfDevelopmentIdeas: [], dataLimitations: ["ยังไม่ validated"],
      };
      res.end(textMessage(JSON.stringify(good)));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const addr = server.address() as { port: number };
  baseURL = `http://127.0.0.1:${addr.port}`;
});
afterAll(() => server.close());

const reportInput = {
  roleTitle: "x", candidateCode: "C-TEST", profile: profileWith(),
  scaleScores: Object.fromEntries(AXES.map((k) => [k, 50])) as Record<(typeof AXES)[number], number>,
  alignment: null,
  responseQuality: { complete: true, answeredCount: 64, totalCount: 64, durationSeconds: 600, longestSameValueRun: 3, mostFrequentValueShare: 0.3, distribution: { 1: 10, 2: 10, 3: 24, 4: 10, 5: 10 }, pairDifferences: [], meanPairDifference: 0, notes: [] },
  axisNames: Object.fromEntries(AXES.map((k) => [k, k])) as Record<(typeof AXES)[number], string>,
};

describe("ClaudeAdapter robustness", () => {
  it("requires configuration", () => {
    expect(() => new ClaudeAdapter({ apiKey: "", model: "m" })).toThrow(AIError);
    expect(() => new ClaudeAdapter({ apiKey: "k", model: "" })).toThrow(AIError);
  });
  it("rejects responses that do not match the schema", async () => {
    mode = "bad_schema";
    const a = new ClaudeAdapter({ apiKey: "test", model: "test-model", baseURL, timeoutMs: 5000 });
    await expect(a.discoveryTurn({ roleTitle: "x", level: "", transcript: [] })).rejects.toMatchObject({ code: "schema" });
  });
  it("times out and reports a timeout error", async () => {
    mode = "slow";
    const a = new ClaudeAdapter({ apiKey: "test", model: "test-model", baseURL, timeoutMs: 500 });
    await expect(a.candidateReport(reportInput)).rejects.toMatchObject({ code: "timeout" });
  }, 20_000);
  it("surfaces refusals", async () => {
    mode = "refusal";
    const a = new ClaudeAdapter({ apiKey: "test", model: "test-model", baseURL, timeoutMs: 5000 });
    await expect(a.candidateReport(reportInput)).rejects.toMatchObject({ code: "refusal" });
  });
  it("accepts a valid structured response", async () => {
    mode = "good";
    const a = new ClaudeAdapter({ apiKey: "test", model: "test-model", baseURL, timeoutMs: 5000 });
    const r = await a.candidateReport(reportInput);
    expect(r.provider).toBe("claude");
    expect(r.model).toBe("test-model");
    expect(r.content.summary).toBe("สรุป");
  });
});

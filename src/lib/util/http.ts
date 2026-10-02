import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = "error",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function jsonError(status: number, message: string, code = "error", details?: unknown) {
  return NextResponse.json({ ok: false, error: { code, message, details } }, { status });
}

/** ห่อ route handler ให้แปลง error เป็น JSON ที่สม่ำเสมอ (ไม่รั่วรายละเอียดภายใน) */
export function handleRoute<T extends unknown[]>(
  fn: (...args: T) => Promise<Response>,
): (...args: T) => Promise<Response> {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ApiError) return jsonError(e.status, e.message, e.code, e.details);
      if (e instanceof ZodError) return jsonError(400, "ข้อมูลไม่ถูกต้อง", "validation", z.treeifyError(e));
      console.error("[route-error]", e instanceof Error ? `${e.name}: ${e.message}` : String(e));
      return jsonError(500, "เกิดข้อผิดพลาดภายในระบบ", "internal");
    }
  };
}

export function getClientIp(req: Request): string {
  const h = req.headers;
  const xf = h.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

export async function readJson<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "รูปแบบข้อมูลไม่ถูกต้อง", "bad_json");
  }
}

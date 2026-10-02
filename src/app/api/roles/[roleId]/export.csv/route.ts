import { requireOrgContext } from "@/lib/auth/server";
import { listCandidates } from "@/lib/services/candidates";
import { getRole } from "@/lib/services/roles";
import { AXES } from "@/lib/model/axes";
import { toCsv } from "@/lib/util/csv";
import { handleRoute } from "@/lib/util/http";
import { audit } from "@/lib/util/audit";

/** CSV ของข้อมูลที่ผู้ใช้มีสิทธิ์ดู (ป้องกัน formula injection ใน toCsv) */
export const GET = handleRoute(async (_req: Request, { params }: { params: Promise<{ roleId: string }> }) => {
  const { roleId } = await params;
  const ctx = await requireOrgContext();
  const role = await getRole(ctx.org.id, roleId);
  const rows = await listCandidates(ctx.org.id, roleId);
  const headers = ["candidate_code", "display_name", "status", "submitted_at", "profile_version", "assessment_version", "scoring_version", "alignment_overall", ...AXES.map((k) => `score_${k}`), ...AXES.map((k) => `alignment_${k}`)];
  const body = rows.map((r) => [
    r.candidateCode,
    r.displayName ?? "",
    r.status,
    r.submittedAt ?? "",
    `v${r.profileVersion}`,
    r.assessmentCode,
    r.alignment?.scoringVersion ?? "",
    r.overall ?? "",
    ...AXES.map((k) => r.scaleScores?.[k] ?? ""),
    ...AXES.map((k) => r.alignment?.axes.find((a) => a.axis === k)?.alignment ?? ""),
  ]);
  await audit({ orgId: ctx.org.id, actorType: "user", actorId: ctx.user.id, action: "export.csv", entityType: "role", entityId: roleId, meta: { rows: rows.length } });
  const safeTitle = role.title.replace(/[^a-zA-Z0-9ก-๙_-]+/g, "_").slice(0, 40);
  return new Response(toCsv(headers, body), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="teamfit_${safeTitle || "role"}.csv"`,
      "cache-control": "no-store",
    },
  });
});

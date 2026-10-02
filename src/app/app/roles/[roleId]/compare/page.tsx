import Link from "next/link";
import { requireOrgContext } from "@/lib/auth/server";
import { getRole } from "@/lib/services/roles";
import { compareCandidates, listCandidates } from "@/lib/services/candidates";
import { Alert, Card, LinkButton } from "@/components/ui";
import { ApiError } from "@/lib/util/http";
import { CompareView } from "./CompareView";

export const metadata = { title: "เปรียบเทียบผู้สมัคร" };

export default async function ComparePage({ params, searchParams }: { params: Promise<{ roleId: string }>; searchParams: Promise<{ ids?: string }> }) {
  const { roleId } = await params;
  const { ids } = await searchParams;
  const ctx = await requireOrgContext();
  await getRole(ctx.org.id, roleId);
  const sessionIds = (ids ?? "").split(",").map((s) => s.trim()).filter((s) => /^[0-9a-f-]{36}$/.test(s));
  if (sessionIds.length < 2) {
    const rows = await listCandidates(ctx.org.id, roleId);
    const completed = rows.filter((r) => r.status === "completed");
    return (
      <Card>
        <Alert tone="info" title="เลือกผู้สมัคร 2–4 คนจากหน้าผู้สมัคร">
          มีผู้สมัครที่ทำครบ {completed.length} คน การเปรียบเทียบจะรวมเฉพาะผู้ที่ใช้โปรไฟล์และแบบประเมินเวอร์ชันเดียวกัน
        </Alert>
        <div className="mt-3"><LinkButton href={`/app/roles/${roleId}/candidates`} variant="primary">ไปเลือกผู้สมัคร</LinkButton></div>
      </Card>
    );
  }
  let result: Awaited<ReturnType<typeof compareCandidates>> | null = null;
  let errorMessage: string | null = null;
  try {
    result = await compareCandidates(ctx.org.id, roleId, sessionIds);
  } catch (e) {
    errorMessage = e instanceof ApiError ? e.message : "เปรียบเทียบไม่ได้";
  }
  if (!result) {
    return (
      <Alert tone="danger">
        {errorMessage} · <Link href={`/app/roles/${roleId}/candidates`} className="underline">กลับไปเลือกใหม่</Link>
      </Alert>
    );
  }
  return <CompareView roleId={roleId} result={result} />;
}

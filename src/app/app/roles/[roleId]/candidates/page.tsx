import { requireOrgContext } from "@/lib/auth/server";
import { getRole } from "@/lib/services/roles";
import { listCandidates } from "@/lib/services/candidates";
import { CandidatesTable } from "./CandidatesTable";

export const metadata = { title: "ผู้สมัคร" };

export default async function CandidatesPage({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  const ctx = await requireOrgContext();
  await getRole(ctx.org.id, roleId);
  const rows = await listCandidates(ctx.org.id, roleId);
  return <CandidatesTable roleId={roleId} rows={rows} />;
}

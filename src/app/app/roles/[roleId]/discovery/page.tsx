import { requireOrgContext } from "@/lib/auth/server";
import { getRole, listDiscoveryMessages, getLatestProposedVersion, getLatestConfirmedVersion } from "@/lib/services/roles";
import { getAIStatus } from "@/lib/ai";
import { DiscoveryChat } from "./DiscoveryChat";

export const metadata = { title: "วิเคราะห์งานกับ AI" };

export default async function DiscoveryPage({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  const ctx = await requireOrgContext();
  const role = await getRole(ctx.org.id, roleId);
  const [messages, proposed, confirmed] = await Promise.all([
    listDiscoveryMessages(roleId),
    getLatestProposedVersion(roleId),
    getLatestConfirmedVersion(roleId),
  ]);
  const ai = getAIStatus();
  return (
    <DiscoveryChat
      roleId={roleId}
      roleTitle={role.title}
      initialMessages={messages}
      hasProposed={Boolean(proposed)}
      hasConfirmed={Boolean(confirmed)}
      ai={ai}
    />
  );
}

import { z } from "zod";
import { requireOrgContext } from "@/lib/auth/server";
import { addNote, listNotes } from "@/lib/services/reports";
import { handleRoute, jsonOk, readJson } from "@/lib/util/http";

const Schema = z.object({ body: z.string().trim().min(1).max(4000) });

export const POST = handleRoute(async (req: Request, { params }: { params: Promise<{ sessionId: string }> }) => {
  const { sessionId } = await params;
  const ctx = await requireOrgContext();
  const body = Schema.parse(await readJson(req));
  await addNote(ctx, sessionId, body.body);
  return jsonOk({ notes: await listNotes(ctx.org.id, sessionId) });
});

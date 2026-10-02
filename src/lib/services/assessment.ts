import { getSql } from "@/lib/db/client";
import { ITEM_BANK, ITEMS_PER_PAGE, ITEM_ORDER } from "@/lib/assessment/items";
import { ASSESSMENT_VERSION_CODE, SCORING_VERSION } from "@/lib/model/versions";

let cachedVersionId: string | null = null;

/** upsert เวอร์ชันแบบประเมินและข้อคำถามจาก item bank (idempotent) และคืน id */
export async function ensureAssessmentVersion(): Promise<string> {
  if (cachedVersionId) return cachedVersionId;
  const sql = getSql();
  const rows = await sql<{ id: string }[]>`
    insert into assessment_versions (code, scoring_version, item_count, items_per_page)
    values (${ASSESSMENT_VERSION_CODE}, ${SCORING_VERSION}, ${ITEM_BANK.length}, ${ITEMS_PER_PAGE})
    on conflict (code) do update set scoring_version = excluded.scoring_version, item_count = excluded.item_count
    returning id
  `;
  const id = rows[0].id;
  const positions = new Map(ITEM_ORDER.map((itemId, i) => [itemId, i + 1]));
  for (const it of ITEM_BANK) {
    await sql`
      insert into assessment_items (id, assessment_version_id, scale, position, text, reverse_scored, context, rationale, pair_group, version)
      values (${it.id}, ${id}, ${it.scale}, ${positions.get(it.id) ?? 0}, ${it.text}, ${it.reverseScored}, ${it.context}, ${it.rationale}, ${it.pairGroup}, ${it.version})
      on conflict (assessment_version_id, id) do update set
        scale = excluded.scale, position = excluded.position, text = excluded.text,
        reverse_scored = excluded.reverse_scored, context = excluded.context, rationale = excluded.rationale,
        pair_group = excluded.pair_group, version = excluded.version
    `;
  }
  cachedVersionId = id;
  return id;
}

export function resetAssessmentCache() {
  cachedVersionId = null;
}

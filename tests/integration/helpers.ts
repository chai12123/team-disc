import { getSql } from "@/lib/db/client";
import type { OrgContext } from "@/lib/auth/server";
import { AXES, type AxisKey } from "@/lib/model/axes";
import type { RoleProfile } from "@/lib/model/roleProfile";
import { METHODOLOGY_VERSION } from "@/lib/model/versions";
import { ITEM_BANK } from "@/lib/assessment/items";
import { createOrganizationForUser, findOrCreateDevUser } from "@/lib/services/org";
import { confirmProfile, createProfileVersion, createRole } from "@/lib/services/roles";
import { ensureAssessmentVersion, resetAssessmentCache } from "@/lib/services/assessment";

export async function truncateAll() {
  const sql = getSql();
  await sql`truncate organizations, users, assessment_versions, rate_limits, audit_events restart identity cascade`;
  resetAssessmentCache();
  await ensureAssessmentVersion();
}

export function ctxFor(orgId: string, userId: string, role: "org_admin" | "recruiter" = "org_admin"): OrgContext {
  return {
    user: { id: userId, email: null, displayName: null },
    org: { id: orgId, name: "", slug: "", dataRetentionDays: 365, isDemo: false },
    membership: { orgId, orgName: "", role, isDemo: false },
    memberships: [],
  };
}

export function profileWith(ranges: Partial<Record<AxisKey, [number, number, number]>> = {}, def: [number, number, number] = [30, 70, 1]): RoleProfile {
  return {
    roleTitle: "ทดสอบ",
    level: "",
    responsibilities: ["ทำงานทดสอบ"],
    successOutcomes: [],
    workContext: { decisionSpeed: "", costOfError: "", routineVsChange: "", authorityLevel: "", teamAndManagerStyle: "", supportAvailable: "", frequentSituations: [] },
    requiredSkills: [],
    unresolvedQuestions: [],
    axes: Object.fromEntries(
      AXES.map((k) => {
        const [targetMin, targetMax, weight] = ranges[k] ?? def;
        return [k, { targetMin, targetMax, weight, rationale: "", evidenceFromConversation: [] }];
      }),
    ) as unknown as RoleProfile["axes"],
    assumptions: [],
    methodologyVersion: METHODOLOGY_VERSION,
  };
}

export async function makeOrgWithRole(email: string, profile = profileWith()) {
  const userId = await findOrCreateDevUser(email);
  const orgId = await createOrganizationForUser(userId, `org-${email}`);
  const ctx = ctxFor(orgId, userId);
  const role = await createRole(ctx, { title: "ตำแหน่งทดสอบ", level: "" });
  const v = await createProfileVersion(role.id, profile, "manual");
  const confirmed = await confirmProfile(ctx, role.id, v.id);
  return { userId, orgId, ctx, role, confirmed };
}

export function allAnswers(value: number | ((reverse: boolean) => number)) {
  return ITEM_BANK.map((it) => ({ itemId: it.id, value: typeof value === "function" ? value(it.reverseScored) : value }));
}

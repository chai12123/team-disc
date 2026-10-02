export type LinkStatus = "active" | "revoked" | "expired" | "not_started" | "in_progress" | "completed";

export interface InvitationStatusInput {
  kind: "shared" | "personal";
  revokedAt: string | null;
  expiresAt: string | null;
  sessionCount: number;
  completedCount: number;
  inProgressCount: number;
}

/** สถานะลิงก์ (client-safe, ไม่พึ่งฐานข้อมูล) */
export function invitationStatus(inv: InvitationStatusInput, now = new Date()): LinkStatus {
  if (inv.kind === "personal" && inv.completedCount > 0) return "completed";
  if (inv.revokedAt) return "revoked";
  if (inv.expiresAt && new Date(inv.expiresAt) < now) return "expired";
  if (inv.kind === "personal") return inv.inProgressCount > 0 ? "in_progress" : "not_started";
  return "active";
}

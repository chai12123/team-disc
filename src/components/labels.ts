export const ROLE_STATUS_LABEL: Record<string, string> = {
  draft: "ร่าง",
  discovery: "กำลังวิเคราะห์งาน",
  profile_review: "รอตรวจโปรไฟล์",
  open: "เปิดรับสมัคร",
  closed: "ปิดแล้ว",
};

export function roleStatusTone(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "open":
      return "success";
    case "profile_review":
      return "warning";
    case "discovery":
      return "info";
    case "closed":
      return "danger";
    default:
      return "neutral";
  }
}

export const SESSION_STATUS_LABEL: Record<string, string> = {
  not_started: "ยังไม่เริ่ม",
  in_progress: "กำลังทำ",
  completed: "ทำครบแล้ว",
  revoked: "เพิกถอนแล้ว",
  expired: "หมดอายุ",
  active: "ใช้งานได้",
  used: "ใช้แล้ว",
};

export function sessionStatusTone(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "completed":
      return "success";
    case "in_progress":
      return "info";
    case "revoked":
    case "expired":
      return "danger";
    case "active":
      return "success";
    default:
      return "neutral";
  }
}

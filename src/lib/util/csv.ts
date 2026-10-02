/**
 * สร้าง CSV ที่ปลอดภัยจาก formula injection:
 * ค่าที่ขึ้นต้นด้วย = + - @ หรือ tab/CR จะถูกนำหน้าด้วย ' และห่อด้วย quote
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s) || s.startsWith("'")) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const r of rows) lines.push(r.map(csvCell).join(","));
  // BOM เพื่อให้ Excel อ่านภาษาไทยถูกต้อง
  return "﻿" + lines.join("\r\n") + "\r\n";
}

import { test, expect, type Page } from "@playwright/test";

/**
 * Flow จริงครบวงจร: dev login → สร้างตำแหน่ง → คุยกับผู้ช่วย (demo) → ยืนยันโปรไฟล์ → คัดลอกลิงก์
 * → เปิดในบริบทผู้สมัคร (context ใหม่ ไม่มี cookie องค์กร, มือถือ) → ทำแบบประเมิน 64 ข้อ → ส่ง → ดูรายงาน
 * → องค์กรดูรายงานและเปรียบเทียบ
 */
async function devLogin(page: Page, email: string) {
  await page.request.post("/api/auth/logout", { maxRedirects: 0 }).catch(() => {});
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await page.waitForURL(/\/app|\/onboarding/);
}

test("องค์กรสร้างตำแหน่งจนถึงเปรียบเทียบผู้สมัคร และผู้สมัครทำแบบประเมินบนมือถือ", async ({ browser }) => {
  const org = await browser.newPage();
  await devLogin(org, "e2e-admin@demo.teamfit.local");
  if (org.url().includes("/onboarding")) {
    await org.getByLabel("ชื่อองค์กร").fill("E2E Org");
    await org.getByRole("button", { name: "สร้างองค์กร" }).click();
    await org.waitForURL(/\/app$/);
  }

  // สร้างตำแหน่ง
  await org.goto("/app/roles/new");
  await org.getByLabel("ชื่อตำแหน่ง").fill("Field Service Engineer");
  await org.getByRole("button", { name: "สร้างและเริ่มวิเคราะห์งาน" }).click();
  await org.waitForURL(/\/discovery$/);
  const roleUrl = org.url().replace(/\/discovery$/, "");

  // คุยกับผู้ช่วย demo: เลือกตัวเลือกแรกไปเรื่อย ๆ จนได้ร่าง
  for (let i = 0; i < 16; i++) {
    const ready = org.getByText("ร่างโปรไฟล์เป้าหมายพร้อมแล้ว");
    if (await ready.isVisible().catch(() => false)) break;
    const option = org.locator("button[aria-pressed]").first();
    await option.waitFor({ state: "visible", timeout: 30_000 });
    await option.click();
    await org.getByRole("button", { name: "ส่งคำตอบ" }).click();
    await org.getByText(/กำลังประมวลผล/).waitFor({ state: "hidden", timeout: 30_000 }).catch(() => {});
  }
  await expect(org.getByText("ร่างโปรไฟล์เป้าหมายพร้อมแล้ว")).toBeVisible();

  // ตรวจและปรับโปรไฟล์ แล้วยืนยัน
  await org.goto(`${roleUrl}/profile`);
  await expect(org.getByText(/ร่าง v1 รอยืนยัน/)).toBeVisible();
  const weight = org.getByLabel("น้ำหนัก").first();
  await weight.fill("2");
  await org.getByRole("button", { name: "ยืนยันโปรไฟล์และเปิดรับสมัคร" }).click();
  await org.getByRole("button", { name: "ยืนยัน", exact: true }).click();
  await org.waitForURL(/\/invitations$/);

  // สร้างลิงก์กลางและคัดลอก
  await org.getByRole("button", { name: "สร้างลิงก์" }).click();
  const code = org.locator("code").first();
  await expect(code).toContainText("/a/");
  const inviteUrl = (await code.textContent())!.trim();
  expect(inviteUrl).not.toMatch(/@/); // ไม่มีอีเมลใน URL

  // ---- ผู้สมัคร: context แยก (ไม่มี cookie องค์กร) บนมือถือ ----
  const cand = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const cp = await cand.newPage();
  await cp.goto(inviteUrl);
  await expect(cp.getByRole("heading", { name: /แบบประเมินพฤติกรรมการทำงาน/ })).toBeVisible();
  // ผู้สมัครเข้าหน้าองค์กรไม่ได้
  const blocked = await cand.request.get(`${new URL(inviteUrl).origin}${new URL(roleUrl).pathname}/candidates`, { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(blocked.status());
  await cp.getByLabel("ชื่อที่แสดง").fill("ผู้สมัคร E2E");
  await cp.getByRole("checkbox").check();
  await cp.getByRole("button", { name: "เริ่มทำแบบประเมิน" }).click();
  await cp.waitForURL(/\/s\//);
  const resumeUrl = cp.url();
  expect(resumeUrl).not.toBe(inviteUrl);

  // ตอบหน้าแรก แล้ว reload เพื่อทดสอบ autosave/resume
  for (let i = 0; i < 8; i++) await cp.locator(`input[type=radio][value="4"]`).nth(i).check();
  await expect(cp.getByRole("status").filter({ hasText: /^บันทึกแล้ว$/ })).toBeVisible({ timeout: 15_000 });
  await cp.reload();
  await expect(cp.getByText(/ตอบแล้ว 8\/64/)).toBeVisible();
  await expect(cp.locator('input[type=radio][value="4"]:checked')).toHaveCount(8);

  // ทำต่อจนครบและส่ง
  for (let page = 0; page < 8; page++) {
    if (page > 0) for (let i = 0; i < 8; i++) await cp.locator(`input[type=radio][value="${(i % 5) + 1}"]`).nth(i).check();
    if (page < 7) await cp.getByRole("button", { name: "ถัดไป →" }).click();
  }
  await cp.getByRole("button", { name: "ส่งแบบประเมิน" }).click();
  await cp.waitForURL(/\/report$/);
  await expect(cp.getByRole("heading", { name: "ผลพฤติกรรมการทำงานที่คุณรายงาน" })).toBeVisible();
  await expect(cp.getByText(/Demo: สร้างจากแม่แบบ/)).toBeVisible({ timeout: 30_000 });
  // รายงานผู้สมัครไม่เปิดเผยเป้าหมาย/ดัชนี
  await expect(cp.getByText(/ดัชนีความสอดคล้องด้านพฤติกรรมกับบทบาท:/)).toHaveCount(0);
  // ส่งซ้ำผ่าน API → ตอบ alreadySubmitted
  const token = resumeUrl.split("/s/")[1].split("/")[0];
  const again = await cand.request.post(`${new URL(inviteUrl).origin}/api/candidate/sessions/${token}/submit`);
  expect((await again.json()).data.alreadySubmitted).toBe(true);

  // ---- องค์กรดูรายงานและเปรียบเทียบ ----
  await org.goto(`${roleUrl}/candidates`);
  await expect(org.getByText("ทำครบแล้ว").first()).toBeVisible();
  await org.getByRole("link", { name: "รายงาน" }).first().click();
  await org.waitForURL(/\/app\/sessions\//);
  await expect(org.getByText("ดัชนีความสอดคล้องด้านพฤติกรรมกับบทบาท")).toBeVisible();
  await expect(org.getByText(/ไม่ใช่เปอร์เซ็นต์โอกาสทำงานสำเร็จ/)).toBeVisible();
  await expect(org.getByText("คำอธิบายสำหรับองค์กร")).toBeVisible();
  await expect(org.getByText("คำถามสัมภาษณ์ที่โยงกับงานจริง")).toBeVisible({ timeout: 30_000 });

  // เปรียบเทียบใน demo org (มีผู้สมัครหลายคน)
  await devLogin(org, "admin@demo.teamfit.local");
  await org.goto("/app/roles");
  await org.getByRole("link", { name: "Sales Consultant" }).click();
  await org.getByRole("link", { name: "ผู้สมัคร" }).click();
  const boxes = org.getByRole("checkbox", { name: /เลือก C-/ });
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await boxes.nth(2).check();
  await org.getByRole("button", { name: "เปรียบเทียบ" }).click();
  await org.waitForURL(/\/compare\?ids=/);
  await expect(org.getByText("ดัชนีความสอดคล้องรวม")).toBeVisible();
  await expect(org.getByText(/Best Candidate|Hire|Reject/)).toHaveCount(0);
  await cand.close();
});

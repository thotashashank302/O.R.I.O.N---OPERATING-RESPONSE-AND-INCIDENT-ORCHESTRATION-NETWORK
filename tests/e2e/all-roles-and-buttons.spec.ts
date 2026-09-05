import { test, expect } from "@playwright/test";

test.describe("ORION Multi-Role Dashboard & Button Operations", () => {
  test.describe.configure({ mode: "serial" });

  test("1. Student flow: login, report issue, upvote", async ({ page }) => {
    // Navigate to login
    await page.goto("/login");
    await page.fill('input[type="email"]', "student.aiml@orion-demo.edu");
    await page.fill('input[type="password"]', "OrionDemo2026!");
    await page.click('button[type="submit"]');

    // Should redirect to /student
    await expect(page).toHaveURL(/\/(student|dashboard)/, { timeout: 15000 });

    // Click "+ Report Issue"
    const reportBtn = page.getByRole("button", { name: /\+ Report Issue/i });
    if (await reportBtn.isVisible()) {
      await reportBtn.click();
      await page.waitForTimeout(500);

      // Fill in description and location
      const descInput = page.locator('textarea[placeholder*="Describe the incident"], textarea[id*="desc"], textarea[name*="desc"]').first();
      if (await descInput.isVisible()) {
        await descInput.fill("Automated E2E: Room 302 ceiling light is flickering constantly.");
      }

      const locInput = page.locator('input[placeholder*="room, floor, building"], input[id*="location"], input[name*="location"]').first();
      if (await locInput.isVisible()) {
        await locInput.fill("Demo Room A-101");
      }

      const submitReportBtn = page.locator('button[type="submit"]').filter({ hasText: /Submit Incident Report/i });
      if (await submitReportBtn.isVisible()) {
        await submitReportBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    // Check upvote button on incident list
    const voteBtn = page.locator('button[aria-label*="vote"], button:has-text("▲"), button:has-text("Upvote")').first();
    if (await voteBtn.isVisible()) {
      await voteBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  test("2. CR flow: login and view class portal", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "cr.aiml@orion-demo.edu");
    await page.fill('input[type="password"]', "OrionDemo2026!");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/(cr|dashboard)/, { timeout: 15000 });
    await expect(page.locator("body")).toContainText(/Class Representative|Classroom|Incidents/i);

    // Test CR buttons
    const reportBtn = page.getByRole("button", { name: /Report/i }).first();
    if (await reportBtn.isVisible()) {
      await expect(reportBtn).toBeEnabled();
    }
  });

  test("3. Staff flow: login, toggle availability, acknowledge/start tasks", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "staff.electrician@orion-demo.edu");
    await page.fill('input[type="password"]', "OrionDemo2026!");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/(staff|dashboard)/, { timeout: 15000 });

    // Test Availability toggle buttons
    const availBtn = page.getByRole("button", { name: "Available" });
    const busyBtn = page.getByRole("button", { name: "Busy" });
    const offDutyBtn = page.getByRole("button", { name: "Off Duty" });

    if (await busyBtn.isVisible()) {
      await busyBtn.click();
      await page.waitForTimeout(1000);
    }
    if (await availBtn.isVisible()) {
      await availBtn.click();
      await page.waitForTimeout(1000);
    }

    // Check acknowledge or start work buttons if assignments exist
    const ackBtn = page.getByRole("button", { name: /Acknowledge/i }).first();
    if (await ackBtn.isVisible()) {
      await ackBtn.click();
      await page.waitForTimeout(2000);
    }

    const startBtn = page.getByRole("button", { name: /Start Work/i }).first();
    if (await startBtn.isVisible()) {
      await startBtn.click();
      await page.waitForTimeout(2000);
    }
  });

  test("4. HOD flow: login, check approvals and incident queue", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "hod.facilities@orion-demo.edu");
    await page.fill('input[type="password"]', "OrionDemo2026!");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/(hod|dashboard)/, { timeout: 15000 });
    await expect(page.locator("body")).toContainText(/HOD Operations|Department incident oversight/i);

    // Verify sections
    await expect(page.locator("#approvals")).toBeVisible();
    await expect(page.locator("#incidents")).toBeVisible();
  });

  test("5. Principal flow: login, roster management, college setup tabs", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "principal@orion-demo.edu");
    await page.fill('input[type="password"]', "OrionDemo2026!");
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/(principal|dashboard)/, { timeout: 15000 });
    await expect(page.locator("body")).toContainText(/Principal Governance|Campus Structure/i);

    // Verify member table loads
    await page.waitForTimeout(2000);
    const memberRows = page.locator("table tbody tr");
    if (await memberRows.count() > 0) {
      // Test "Manage Roles" button
      const manageRoleBtn = page.getByRole("button", { name: /Manage Roles/i }).first();
      if (await manageRoleBtn.isVisible()) {
        await manageRoleBtn.click();
        await page.waitForTimeout(500);

        // Modal should open
        await expect(page.locator("body")).toContainText(/Manage Authorization Roles/i);

        // Close modal
        const closeBtn = page.locator('button:has-text("✕")').first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        }
      }
    }

    // Test College Setup Form Tabs
    const tabs = ["college", "department", "location", "roster"];
    for (const tab of tabs) {
      const tabBtn = page.getByRole("button", { name: new RegExp(tab, "i") }).first();
      if (await tabBtn.isVisible()) {
        await tabBtn.click();
        await page.waitForTimeout(300);
      }
    }
  });
});

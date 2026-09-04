import { expect, test } from "@playwright/test";

test("renders the ORION entry experience", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "O.R.I.O.N" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Enter operations/ })).toHaveAttribute("href", "/login");
  await expect(page.locator('img[alt="Modern university operations campus at night"]')).toBeVisible();
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  await page.screenshot({ path: ".impeccable/review/desktop.png", fullPage: true });
});

test("login remains usable on a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in to ORION" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Continue/ })).toBeVisible();
  await expect(page.locator('img[alt="Modern university campus building at night"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: ".impeccable/review/mobile.png", fullPage: true });
});

test("redirects unauthenticated dashboard access to the real login page", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in to ORION" })).toBeVisible();
});

test("secure acknowledgement GET is non-mutating and handles missing links", async ({ page }) => {
  await page.goto("/email-actions/confirm");
  await expect(page.getByRole("heading", { name: "Acknowledge your assignment" })).toBeVisible();
  await expect(page.getByText("The action link is missing or incomplete.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Acknowledge assignment" })).toHaveCount(0);
  await page.screenshot({ path: ".impeccable/review/email-action-desktop.png", fullPage: true });
});

test("secure acknowledgement form remains usable on a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/email-actions/confirm?token=abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnop");
  const button = page.getByRole("button", { name: "Acknowledge assignment" });
  await expect(button).toBeVisible();
  const box = await button.boundingBox();
  expect(box?.width).toBeGreaterThan(250);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: ".impeccable/review/email-action-mobile.png", fullPage: true });
});

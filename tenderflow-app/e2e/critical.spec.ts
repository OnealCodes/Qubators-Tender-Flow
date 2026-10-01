import { expect, test } from "@playwright/test";
import { buildSamplePdf } from "./sample-pdf";

const email = (tag: string) => `${tag}${Date.now()}@test.local`;

async function signUp(page: import("@playwright/test").Page, tag: string) {
  await page.goto("/sign-up");
  await page.getByLabel(/full name/i).fill(`${tag} User`);
  await page.getByLabel(/work email/i).fill(email(tag));
  await page.getByLabel(/password/i).fill("TestPass123");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/workspace/, { timeout: 60000 });
}

test("landing shows the Upload CTA", async ({ page }) => {
  await page.goto("/");
  const cta = page.getByRole("link", { name: /upload your tender/i }).first();
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", "/upload");
});

test("workspace redirects anonymous visitors to sign-in", async ({ page }) => {
  await page.goto("/workspace");
  await expect(page).toHaveURL(/sign-in/, { timeout: 30000 });
});

test("sign-up creates a manager and lands in the workspace", async ({ page }) => {
  await signUp(page, "e2emanager");
  await expect(page.getByRole("tab", { name: /^matrix$/i })).toBeVisible({ timeout: 30000 });
  await page.goto("/team");
  await expect(page.getByText(/manager/i).first()).toBeVisible({ timeout: 30000 });
});

test("upload parses a tender and rules-only extraction builds rows", async ({ page }) => {
  await signUp(page, "e2epilot");
  await page.goto("/upload");
  const pdf = buildSamplePdf();
  await page.locator('input[type="file"]').setInputFiles({
    name: "e2e-sample.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  await expect(page.getByText(/pages parsed|already uploaded/i)).toBeVisible({ timeout: 120000 });
  await page.goto("/workspace");
  // Rules-only mode avoids external AI calls: deterministic in tests.
  const aiToggle = page.getByLabel(/toggle ai assistance/i);
  if (await aiToggle.isChecked()) await aiToggle.uncheck();
  await page.getByRole("button", { name: /run extraction/i }).click();
  await expect(page.getByText(/new ·|hand-edits kept/i).first()).toBeVisible({ timeout: 180000 });
  await expect(page.getByText(/NUPRC certificate/i).first()).toBeVisible({ timeout: 30000 });
});

test("anonymous API calls are rejected as JSON, not HTML", async ({ request }) => {
  const r = await request.get("/api/tenders");
  expect(r.status()).toBe(401);
  expect(r.headers()["content-type"]).toContain("application/json");
});

import { test, expect } from "@playwright/test";

// No AI backend runs during e2e (Omniroute is the user's own local
// service, not something CI can stand up), so these verify the
// graceful-degradation path: every AI entry point must show a clear
// error instead of crashing or silently doing nothing when the
// configured endpoint isn't reachable.

test("AI chat shows a clear error when the endpoint is unreachable", async ({ page }) => {
  await page.goto("/ai");
  await page.locator('input[placeholder*="Ask about"]').fill("What is my win rate?");
  await page.getByRole("button").last().click();
  await expect(page.getByText(/Couldn't reach the AI endpoint/)).toBeVisible({ timeout: 10000 });
});

test("Report AI insight shows a clear error when unreachable", async ({ page }) => {
  await page.goto("/reports");
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByText(/Couldn't reach the AI endpoint/)).toBeVisible({ timeout: 10000 });
});

import { test, expect } from "@playwright/test";

test("progress tracker: add a daily rule, check in, streak updates", async ({ page }) => {
  await page.goto("/progress");
  await page.getByText("Add a rule").click();
  await page.locator('input[placeholder*="Risked"]').fill("E2E Daily Rule");
  await page.getByRole("button", { name: "Check daily" }).click();
  await page.getByRole("button", { name: "Add Rule" }).click();
  await expect(page.getByRole("button", { name: "E2E Daily Rule" })).toBeVisible();

  await page.getByRole("button", { name: "E2E Daily Rule" }).click();
  await expect(page.getByText(/day.* in a row/)).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Progress Tracker" })).toBeVisible();
  await expect(page.getByText("followed today")).toBeVisible();
});

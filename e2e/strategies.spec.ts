import { test, expect } from "@playwright/test";

test("strategies: create with rules, attach a trade, stats reflect it", async ({ page }) => {
  await page.goto("/strategies/new");
  await page.locator('input[placeholder*="Opening Range"]').fill("E2E Strategy");
  // New strategies start pre-populated with Entry Rules/Exit Rules starter
  // groups (each with one empty rule input) — fill the first rather than
  // adding a group from scratch.
  await page.locator('input[placeholder*="20 EMA"]').first().fill("Test rule");
  await page.getByRole("button", { name: "Create Strategy" }).click();
  await page.waitForURL(/\/strategies\/c[a-z0-9]+$/);

  await expect(page.getByRole("heading", { name: "E2E Strategy" })).toBeVisible();
  await expect(page.getByText("Test rule")).toBeVisible();

  const strategyUrl = page.url();

  // Create a trade and assign this strategy directly from the trade form.
  await page.goto("/trades/new");
  await page.locator('input[placeholder="AAPL"]').fill("STRATE2E");
  await page.locator("select").nth(2).selectOption({ label: "E2E Strategy" });
  const numberInputs = page.locator('input[type="number"]');
  await numberInputs.nth(0).fill("10");
  await numberInputs.nth(2).fill("50");
  await numberInputs.nth(3).fill("60");
  await page.getByRole("button", { name: "Add Trade" }).click();
  await page.waitForURL(/\/trades\/c[a-z0-9]+$/);
  await expect(page.getByRole("link", { name: "E2E Strategy" })).toBeVisible();

  await page.goto(strategyUrl);
  await expect(page.getByText("$100.00").first()).toBeVisible(); // (60-50)*10
  await expect(page.getByRole("cell", { name: "STRATE2E" })).toBeVisible();
});

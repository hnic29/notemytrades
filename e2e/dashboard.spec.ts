import { test, expect } from "@playwright/test";

test("dashboard renders stats and journal shows the same trade", async ({ page }) => {
  // Seed a closed trade via the manual entry form so the dashboard has
  // something real to aggregate, rather than asserting on empty state.
  await page.goto("/trades/new");
  await page.locator('input[placeholder="AAPL"]').fill("DASH");
  const numberInputs = page.locator('input[type="number"]');
  await numberInputs.nth(0).fill("10");
  await numberInputs.nth(2).fill("100");
  await numberInputs.nth(3).fill("120");
  await page.getByRole("button", { name: "Add Trade" }).click();
  await page.waitForURL(/\/trades\/c[a-z0-9]+$/);

  // Dashboard stats are a global aggregate across every trade in this
  // single-user app (no per-test data isolation), so assert on
  // structure/presence here rather than an exact P&L figure — the
  // trade's own P&L is already verified in trades.spec.ts.
  await page.goto("/dashboard");
  await expect(page.getByText("Net P&L")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trade Score" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Equity Curve" })).toBeVisible();

  const today = new Date().toISOString().slice(0, 10);
  await page.goto(`/journal?date=${today}`);
  await expect(page.getByRole("link", { name: "DASH", exact: true })).toBeVisible();
});

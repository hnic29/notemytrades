import { test, expect } from "@playwright/test";

test("backtesting: create a session, place and close a trade", async ({ page }) => {
  await page.goto("/backtesting/new");
  await page.locator('input[placeholder="AAPL"]').fill("AAPL");
  await page.locator("select").selectOption("1h");
  await page.getByRole("button", { name: "Start Session" }).click();
  await page.waitForURL(/\/backtesting\/c[a-z0-9]+$/, { timeout: 20000 });

  await expect(page.locator("canvas").first()).toBeVisible();

  await page.getByTitle("Step forward").click();
  await page.getByTitle("Step forward").click();
  await page.getByRole("button", { name: "Buy / Long" }).click();
  await expect(page.getByText("unrealized")).toBeVisible();

  await page.getByTitle("Step forward").click();
  await page.getByRole("button", { name: "Close Position" }).click();
  await expect(page.getByText("Trades in this session (1)")).toBeVisible();
});

test("trade replay: renders a chart for an existing trade", async ({ page }) => {
  await page.goto("/trades/new");
  await page.locator('input[placeholder="AAPL"]').fill("AAPL");
  const numberInputs = page.locator('input[type="number"]');
  await numberInputs.nth(0).fill("10");
  await numberInputs.nth(2).fill("300");
  await numberInputs.nth(3).fill("320");
  await page.getByRole("button", { name: "Add Trade" }).click();
  await page.waitForURL(/\/trades\/c[a-z0-9]+$/);

  await page.getByRole("button", { name: "Replay" }).click();
  await page.waitForURL(/\/replay$/);
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect(page.getByTitle("Step forward")).toBeVisible();
});

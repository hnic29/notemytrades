import { test, expect } from "@playwright/test";

test("reports: filters persist across tabs and scope the data", async ({ page }) => {
  // Seed two trades with different symbols via manual entry.
  for (const symbol of ["RPTA", "RPTB"]) {
    await page.goto("/trades/new");
    await page.locator('input[placeholder="AAPL"]').fill(symbol);
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill("10");
    await numberInputs.nth(2).fill("50");
    await numberInputs.nth(3).fill("60");
    await page.getByRole("button", { name: "Add Trade" }).click();
    await page.waitForURL(/\/trades\/c[a-z0-9]+$/);
  }

  await page.goto("/reports/symbol");
  await expect(page.getByRole("cell", { name: "RPTA" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "RPTB" })).toBeVisible();

  await page.fill('input[placeholder="Symbol"]', "RPTA");
  await page.keyboard.press("Enter");
  await page.waitForURL(/symbol=RPTA/);
  await expect(page.getByRole("cell", { name: "RPTA" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "RPTB" })).not.toBeVisible();

  // Filter should carry over when switching report tabs.
  await page.getByRole("link", { name: "Risk" }).click();
  await expect(page).toHaveURL(/reports\/risk.*symbol=RPTA/);

  await page.getByRole("button", { name: /Clear/ }).click();
  await expect(page).not.toHaveURL(/symbol=RPTA/);
});

test("reports: compare tool switches dimensions", async ({ page }) => {
  await page.goto("/reports/compare");
  await page.getByRole("button", { name: "Side" }).click();
  await expect(page.locator("select").first()).toBeVisible();
});

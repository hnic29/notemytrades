import { test, expect } from "@playwright/test";
import path from "node:path";

test("manual trade: create, view detail, share, edit, delete", async ({ page }) => {
  await page.goto("/trades/new");
  await page.locator('input[placeholder="AAPL"]').fill("E2ETEST");
  const numberInputs = page.locator('input[type="number"]');
  await numberInputs.nth(0).fill("10"); // quantity
  await numberInputs.nth(2).fill("100"); // entry
  await numberInputs.nth(3).fill("110"); // exit
  await page.getByRole("button", { name: "Add Trade" }).click();

  await page.waitForURL(/\/trades\/c[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: "E2ETEST" })).toBeVisible();
  await expect(page.getByText("10.0% ROI")).toBeVisible(); // confirms P&L computed correctly

  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByRole("button", { name: /Copy Share Link/ })).toBeVisible();

  await page.getByRole("button", { name: "Edit" }).click();
  await page.waitForURL(/\/edit$/);
  await expect(page.locator('input[placeholder="AAPL"]')).toHaveValue("E2ETEST");

  await page.goBack();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await page.waitForURL("**/trades");
  await expect(page.getByText("E2ETEST")).not.toBeVisible();
});

test("CSV import: maps columns and imports valid rows", async ({ page }) => {
  await page.goto("/trades/import");
  await page.setInputFiles(
    'input[type="file"]',
    path.join(__dirname, "fixtures", "sample-trades.csv"),
  );
  await page.waitForSelector("text=Map Columns");
  await expect(page.getByText(/3 trades ready/)).toBeVisible();
  await expect(page.getByText(/1 row skipped/)).toBeVisible();

  await page.getByRole("button", { name: /Import \d+ Trades/ }).click();
  await expect(page.getByText("Imported 3 trades")).toBeVisible();

  await page.getByRole("button", { name: "Go to Trade Log" }).click();
  await page.waitForURL("**/trades");
  await expect(page.getByText("MSFT")).toBeVisible();
  await expect(page.getByText("TSLA")).toBeVisible();
  await expect(page.getByText("NVDA")).toBeVisible();
});

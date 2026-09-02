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
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles(path.join(__dirname, "fixtures", "sample-trades.csv"));
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

test("TradingView paper trading: multi-file import pairs fills, then skips duplicates on re-import", async ({
  page,
}) => {
  // Everything TradingView's export produces, handed over without sorting.
  const files = ["activity-log", "orders-all", "order-history-all", "positions", "balance-history"].map(
    (f) => path.join(__dirname, "fixtures", "tradingview", `paper-trading-${f}.csv`),
  );

  await page.goto("/trades/import");
  await page.locator('input[type="file"]').first().setInputFiles(files);

  await expect(page.getByText("Detected: TradingView Paper Trading")).toBeVisible();
  await expect(page.getByText("Map Columns")).not.toBeVisible();
  await expect(page.getByText("Order history", { exact: true })).toBeVisible();
  await expect(page.getByText("Positions", { exact: true })).toBeVisible();
  await expect(page.getByText("Balance history", { exact: true })).toBeVisible();
  await expect(page.getByText("not needed — ignored")).toHaveCount(2);
  await expect(page.getByText(/2 trades ready/)).toBeVisible();
  // Continuous contract collapsed to its root, asset type picked up from the exchange.
  await expect(page.getByLabel("Asset Type")).toHaveValue("futures");
  await expect(page.getByText(/opened before the start of this order history export/)).toBeVisible();
  await expect(page.getByText(/1 short still open/)).toBeVisible();
  await expect(page.getByText(/doesn't match/)).not.toBeVisible();

  await page.getByRole("button", { name: /Import \d+ Trades/ }).click();
  await expect(page.getByText("Imported 2 trades")).toBeVisible();

  // Same three files again: nothing new, nothing duplicated.
  await page.goto("/trades/import");
  await page.locator('input[type="file"]').first().setInputFiles(files);
  await page.getByRole("button", { name: /Import \d+ Trades/ }).click();
  await expect(page.getByText("Nothing new to import")).toBeVisible();
  await expect(page.getByText(/2 already in this account/)).toBeVisible();

  await page.getByRole("button", { name: "Go to Trade Log" }).click();
  await page.waitForURL("**/trades");
  await expect(page.getByText("MNQ").first()).toBeVisible();
});

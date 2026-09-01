import { test, expect } from "@playwright/test";

test("prop accounts: create, log a fee and payout, trade flows through to balance", async ({
  page,
}) => {
  await page.goto("/prop-accounts/new");
  await page.locator('input[placeholder="FTMO 100k #1"]').fill("E2E Prop Account");
  await page.locator('input[placeholder="FTMO"]').fill("E2E Firm");
  const numberInputs = page.locator('input[type="number"]');
  await numberInputs.nth(0).fill("100000");
  await numberInputs.nth(1).fill("10000");
  await page.getByRole("button", { name: "Create Prop Account" }).click();
  await page.waitForURL(/\/prop-accounts\/c[a-z0-9]+$/);

  await expect(page.getByRole("heading", { name: "E2E Prop Account" })).toBeVisible();
  await expect(page.getByText("$100,000.00").first()).toBeVisible(); // current balance = size

  await page.getByText("Add a transaction").click();
  await page.locator("select").first().selectOption("fee");
  await page.locator('input[type="number"]').first().fill("-100");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("-$100.00")).toBeVisible();
  await expect(page.getByText("$99,900.00")).toBeVisible(); // balance updated

  // Trade against this account flows into its balance.
  await page.goto("/trades/new");
  await page.locator("select").first().selectOption({ label: "E2E Prop Account" });
  await page.locator('input[placeholder="AAPL"]').fill("PROPE2E");
  const numInputs2 = page.locator('input[type="number"]');
  await numInputs2.nth(0).fill("10");
  await numInputs2.nth(2).fill("50");
  await numInputs2.nth(3).fill("60");
  await page.getByRole("button", { name: "Add Trade" }).click();
  await page.waitForURL(/\/trades\/c[a-z0-9]+$/);

  await page.goto("/prop-accounts");
  await expect(page.getByRole("link", { name: /E2E Prop Account/ })).toBeVisible();
});

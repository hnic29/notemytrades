import { test, expect } from "@playwright/test";

test("home redirects to dashboard and sidebar nav works", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("Note My Trades")).toBeVisible();

  const stops: [string, string][] = [
    ["/trades", "Trade Log"],
    ["/notebook", "Notebook"],
    ["/reports", "Reports & Filters"],
  ];

  for (const [href, heading] of stops) {
    await page.locator(`a[href="${href}"]`).click();
    await expect(page).toHaveURL(new RegExp(href.replace("/", "\\/") + "$"));
    await expect(
      page.getByRole("heading", { name: heading }),
    ).toBeVisible();
    await expect(page.locator(`a[href="${href}"]`)).toHaveClass(/bg-surface-2/);
  }

  expect(errors).toEqual([]);
});

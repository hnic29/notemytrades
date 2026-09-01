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
    ["/reports", "Reports & Filters"],
    ["/strategies", "Strategies"],
  ];

  for (const [href, heading] of stops) {
    await page.locator(`a[href="${href}"]`).click();
    await expect(page).toHaveURL(new RegExp(href.replace("/", "\\/") + "$"));
    await expect(
      page.getByRole("heading", { name: heading }),
    ).toBeVisible();
    await expect(page.locator(`a[href="${href}"]`)).toHaveClass(/bg-surface-2/);
  }

  // Notebook is a dense two-panel workspace with no page-level <h1> (its
  // own inner sidebar already labels it), so check it separately.
  await page.locator('a[href="/notebook"]').click();
  await expect(page).toHaveURL(/\/notebook$/);
  await expect(page.getByText("Notebook", { exact: true }).last()).toBeVisible();

  expect(errors).toEqual([]);
});

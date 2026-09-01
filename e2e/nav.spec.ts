import { test, expect } from "@playwright/test";

test("home redirects to dashboard and sidebar nav works", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  // Scoped to the sidebar <aside>: the mobile nav's top bar renders the
  // same "Note My Trades" text (hidden via CSS at desktop widths, but
  // still present in the DOM), which would otherwise make this ambiguous.
  await expect(page.locator("aside").getByText("Note My Trades")).toBeVisible();

  const stops: [string, string][] = [
    ["/trades", "Trade Log"],
    ["/reports", "Reports & Filters"],
    ["/strategies", "Strategies"],
  ];

  for (const [href, heading] of stops) {
    // Scoped to the sidebar <aside>: some pages (e.g. Reports) render
    // their own in-page nav with a link sharing the same href (the
    // Overview report tab is href="/reports" too), which would
    // otherwise make these locators ambiguous.
    await page.locator(`aside a[href="${href}"]`).click();
    await expect(page).toHaveURL(new RegExp(href.replace("/", "\\/") + "$"));
    await expect(
      page.getByRole("heading", { name: heading }),
    ).toBeVisible();
    await expect(page.locator(`aside a[href="${href}"]`)).toHaveClass(/bg-surface-2/);
  }

  // Notebook is a dense two-panel workspace with no page-level <h1> (its
  // own inner sidebar already labels it), so check it separately.
  await page.locator('aside a[href="/notebook"]').click();
  await expect(page).toHaveURL(/\/notebook$/);
  await expect(page.getByText("Notebook", { exact: true }).last()).toBeVisible();

  expect(errors).toEqual([]);
});

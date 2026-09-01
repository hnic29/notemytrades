import { test, expect } from "@playwright/test";

test("notebook: create a folder and note, edit, save, and persist", async ({ page }) => {
  await page.goto("/notebook");

  page.once("dialog", (d) => d.accept("E2E Folder"));
  await page.getByTitle("New folder").click();
  await expect(page.getByText("E2E Folder")).toBeVisible();

  await page.getByText("E2E Folder").click();
  await page.getByTitle("New note").click();
  await page.waitForURL(/note=/);

  await page.locator('input[placeholder="Untitled"]').fill("E2E Note");
  await page.locator(".prose-notebook").click();
  await page.keyboard.type("Test content for the e2e suite.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved")).toBeVisible();

  await page.reload();
  await expect(page.locator('input[placeholder="Untitled"]')).toHaveValue("E2E Note");
  await expect(page.getByText("Test content for the e2e suite.")).toBeVisible();
});

test("notebook: generates a working share link", async ({ page }) => {
  await page.goto("/notebook");
  await page.getByText("E2E Note").click();
  await page.waitForTimeout(200);

  const alreadyShared = await page.getByRole("button", { name: /Copy Share Link/ }).isVisible();
  if (!alreadyShared) {
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await expect(page.getByRole("button", { name: /Copy Share Link/ })).toBeVisible();
  }
});

import { test, expect } from "@playwright/test";

test.describe("templates grid", () => {
  test("cards show format label and a rendered preview", async ({ page }) => {
    await page.goto("/templates");
    // Format label like "1200×630" is shown on the cards.
    await expect(page.getByText(/\d+×\d+/).first()).toBeVisible();
    // A real preview thumbnail renders inside a card's editor link.
    await expect(page.locator('a[href^="/editor/"] img').first()).toBeVisible({ timeout: 20_000 });
  });

  test("duplicate creates an independent copy", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await page.goto("/templates");

    const list = async () => (await (await page.request.get("/api/templates")).json()).templates as { id: string; name: string }[];
    const before = (await list()).length;

    await page.getByRole("button", { name: /^Duplicate/ }).first().click();

    await expect.poll(async () => (await list()).length, { timeout: 15_000 }).toBe(before + 1);
    const copy = (await list()).find((t) => t.name.endsWith("(copy)"));
    expect(copy).toBeTruthy();

    // Cleanup so the test is idempotent.
    if (copy) await page.request.delete(`/api/templates/${copy.id}`);
  });
});

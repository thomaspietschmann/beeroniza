import { test, expect } from "@playwright/test";

// Admin reset is destructive, so the e2e test only verifies the guards — it
// never actually triggers a reset.
test.describe("admin reset", () => {
  test("button arms only after typing RESET; API rejects without confirmation", async ({ page }) => {
    await page.goto("/admin");

    const button = page.getByRole("button", { name: "Reset application" });
    await expect(button).toBeDisabled();

    await page.getByRole("textbox").first().fill("RESET");
    await expect(button).toBeEnabled();

    // API guard: a wrong/missing confirmation phrase is a 400 (no reset happens).
    const res = await page.request.post("/api/admin/reset", { data: { confirm: "nope" } });
    expect(res.status()).toBe(400);
  });
});

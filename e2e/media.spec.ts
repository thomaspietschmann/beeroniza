import { test, expect } from "@playwright/test";

// Media library: upload → appears, rename, delete (with confirm dialogs).
test.describe("media library", () => {
  test("upload, rename and delete an image", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await page.goto("/media");

    await page.locator('input[type="file"]').first().setInputFiles("e2e/fixtures/sample.png");

    // Newest upload is first; address it positionally so the locator stays valid
    // even while the inline rename input replaces the name text.
    const tile = page.getByTestId("media-tile").first();
    await expect(tile).toContainText("sample.png", { timeout: 20_000 });

    // Rename inline.
    await tile.getByRole("button", { name: "Rename" }).click();
    const input = tile.getByRole("textbox");
    await input.fill("renamed-by-e2e");
    await input.press("Enter");
    await expect(tile).toContainText("renamed-by-e2e");

    // Delete it again.
    await tile.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByTestId("media-tile").filter({ hasText: "renamed-by-e2e" })).toHaveCount(0);
  });
});

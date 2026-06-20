import { test as setup, expect } from "@playwright/test";
import { TEST_EMAIL, TEST_PASSWORD } from "./test-user";

// Logs in as the isolated e2e test user (created by global setup) once and saves
// the session, reused by the chromium project's storageState.
const authFile = "e2e/.auth/admin.json";

setup("authenticate", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByText(TEST_EMAIL)).toBeVisible();
  await page.context().storageState({ path: authFile });
});

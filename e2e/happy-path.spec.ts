import { test, expect } from "@playwright/test";

// Admin happy path: sign in, add a sister, post a window, see it on the board.
// The token-response + escalation flow is covered by the integration tests.
test("admin can sign in, add a respondent, and post a window", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Admin password").fill(process.env.ADMIN_PASSWORD ?? "dev-change-me");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "CareCover" })).toBeVisible();

  // Add a sister.
  await page.getByRole("link", { name: "Respondents" }).click();
  await page.locator('input[name="name"]').first().fill("E2E Sister");
  await page.locator('input[name="phone"]').first().fill("555-321-7654");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator('input[value="E2E Sister"]')).toBeVisible();

  // Post a window.
  await page.getByRole("link", { name: "← Windows" }).click();
  await page.locator('input[name="startsAtLocal"]').fill("2026-08-01T09:00");
  await page.locator('input[name="endsAtLocal"]').fill("2026-08-01T17:00");
  await page.locator('input[name="notes"]').fill("E2E coverage");
  await page.getByRole("button", { name: /Post/ }).click();

  await expect(page.getByText("E2E coverage")).toBeVisible();
});

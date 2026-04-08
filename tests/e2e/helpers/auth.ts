import type { Page } from "@playwright/test";

export const TEST_USER_EMAIL = process.env.E2E_TEST_EMAIL ?? "dev@example.com";
export const TEST_USER_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "password1234";

export async function loginAs(page: Page, email = TEST_USER_EMAIL, password = TEST_USER_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL("/dashboard", { timeout: 10000 });
}

export async function logout(page: Page) {
  // Look for a logout button in the nav
  const logoutButton = page.getByRole("button", { name: /log out|sign out/i });
  if (await logoutButton.isVisible()) {
    await logoutButton.click();
    await page.waitForURL("/login");
  }
}

// klin:file password
import { expect, test } from "@playwright/test"

test("sign up, create a note, find it again", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`

  await page.goto("/sign-up")
  await page.getByLabel("Name").fill("Playwright Tester")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill("e2e-password-123")
  await page.getByLabel("Confirm password").fill("e2e-password-123")
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page).toHaveURL(/\/dashboard/)

  await page.goto("/notes")
  await page.getByRole("button", { name: "New note" }).first().click()
  await page.getByLabel("Title").fill("Hello from Playwright")
  await page.getByLabel("Content").fill("Created by an end-to-end test.")
  await page.getByRole("button", { name: "Create note" }).click()

  await expect(page.getByText("Hello from Playwright")).toBeVisible()
  await page.reload()
  await expect(page.getByText("Hello from Playwright")).toBeVisible()
})

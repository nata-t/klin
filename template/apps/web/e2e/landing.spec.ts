import { expect, test } from "@playwright/test"

test("landing page shows the hero and a way in", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await expect(page.getByRole("link", { name: /get started/i }).first()).toBeVisible()
})

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/dashboard")
  await expect(page).toHaveURL(/\/sign-in\?redirect=/)
})

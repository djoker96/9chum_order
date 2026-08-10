import path from "node:path"
import { expect, test } from "@playwright/test"

const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD
const workbookPath = path.resolve(__dirname, "fixtures/products-import.xlsx")

test("admin imports a valid Excel product workbook", async ({ page }) => {
  test.skip(
    !adminEmail || !adminPassword,
    "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run authenticated E2E tests",
  )

  await page.goto("/login")
  await page.getByLabel("Email").fill(adminEmail as string)
  await page.getByLabel("Mật khẩu").fill(adminPassword as string)
  await page.getByRole("button", { name: "Đăng nhập" }).click()
  await expect(page).toHaveURL(/\/invoices\/create/)

  await page.goto("/admin/products")
  await page.locator('input[type="file"]').setInputFiles(workbookPath)

  await expect(page.getByText(/Import xong:/)).toBeVisible()
  const importedProduct = page
    .getByRole("row")
    .filter({ hasText: "E2E-XLSX-001" })
  await expect(importedProduct).toContainText("Sản phẩm Excel E2E")
  await expect(importedProduct).toContainText("20ml · 15%")
  await expect(importedProduct).toContainText("215.000đ")
})

import { test, expect } from "@playwright/test"

const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD

test.describe("user administration", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run authenticated E2E tests")
    await page.goto("/login")
    await page.getByLabel("Email").fill(adminEmail as string)
    await page.getByLabel("Mật khẩu").fill(adminPassword as string)
    await page.getByRole("button", { name: "Đăng nhập" }).click()
    await expect(page).toHaveURL(/\/invoices\/create/)
  })

  test("admin can create and deactivate a staff account", async ({ page, browser }) => {
    const email = `e2e-${Date.now()}@example.com`
    await page.goto("/admin/users")
    await expect(page.getByRole("heading", { name: "Quản lý tài khoản" })).toBeVisible()

    await page.getByRole("button", { name: "Tạo tài khoản" }).click()
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Tên hiển thị").fill("E2E Staff")
    await page.locator("#user-role").selectOption("STAFF")
    await page.getByLabel("Mật khẩu", { exact: true }).fill("e2e-secure-password")
    await page.getByLabel("Xác nhận mật khẩu").fill("e2e-secure-password")
    await page.getByRole("button", { name: "Lưu tài khoản" }).click()

    const row = page.getByRole("row").filter({ hasText: email })
    await expect(row).toContainText("Đang hoạt động")
    page.once("dialog", (dialog) => dialog.accept())
    await row.getByRole("button", { name: "Tắt" }).click()
    await expect(row).toContainText("Đã vô hiệu hóa")

    const staffContext = await browser.newContext()
    const staffPage = await staffContext.newPage()
    await staffPage.goto("/login")
    await staffPage.getByLabel("Email").fill(email)
    await staffPage.getByLabel("Mật khẩu").fill("e2e-secure-password")
    await staffPage.getByRole("button", { name: "Đăng nhập" }).click()
    await expect(staffPage.getByText("Tài khoản đã bị vô hiệu hóa.")).toBeVisible()
    await expect(staffPage).toHaveURL(/\/login/)
    await staffContext.close()
  })
})

import { test, expect, type Locator, type Page } from "@playwright/test"

const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD

async function chooseSelect(page: Page, scope: Locator, label: string, option: string): Promise<void> {
  await scope.getByRole("combobox", { name: label }).click()
  await page.getByRole("option", { name: option, exact: true }).click()
}

test.describe("invoice critical flow", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!adminEmail || !adminPassword, "Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run authenticated E2E tests")
    await page.goto("/login")
    await page.getByLabel("Email").fill(adminEmail as string)
    await page.getByLabel("Mật khẩu").fill(adminPassword as string)
    await page.getByRole("button", { name: "Đăng nhập" }).click()
    await expect(page).toHaveURL(/\/invoices\/create/)
  })

  test("creates an invoice with a dependent product variant and free shipping", async ({ page }) => {
    await page.getByLabel("Tên khách hàng").fill("E2E Customer")
    await page.getByLabel("Số điện thoại").fill("0900000002")
    await page.getByLabel("Địa chỉ giao hàng").fill("Hà Nội")
    const orderSections = page.locator("fieldset")
    await expect(orderSections.nth(0)).toContainText("Thanh toán")
    await expect(orderSections.nth(1)).toContainText("Vận chuyển")
    await expect(orderSections.nth(2)).toContainText("Kho")
    await expect(page.getByRole("radio", { name: "Không chọn" })).toHaveAttribute("aria-checked", "true")
    await expect(page.getByRole("radio", { name: "Xuất kho L7-21" })).toBeVisible()
    await page.getByRole("radio", { name: "Xuất kho L7-22" }).click()
    const previewSummaryRows = page.locator(".invoice-summary > div")
    await expect(previewSummaryRows.nth(2)).toContainText("Vận chuyển")
    await expect(previewSummaryRows.nth(3)).toContainText("Xuất kho")
    await expect(previewSummaryRows.nth(3)).toContainText("L7-22")

    const productRow = page.locator(".product-row").first()
    await chooseSelect(page, productRow, "Tên sản phẩm", "Sản phẩm A")
    await chooseSelect(page, productRow, "Thể tích", "30ml")
    await chooseSelect(page, productRow, "Nồng độ", "10%")
    await productRow.getByLabel("Số lượng").fill("2")
    await page.getByRole("button", { name: "Tạo hóa đơn" }).click()

    await expect(page.getByText("Đã lưu")).toBeVisible()
    await expect(page.getByTestId("invoice-preview")).toContainText("360.000đ")
    await expect(page.getByTestId("invoice-preview")).toContainText("Xuất kho")
  })

  test("hides the shipping fee row when paid shipping has no fee", async ({ page }) => {
    const preview = page.getByTestId("invoice-preview")

    await page.getByRole("radio", { name: "App giao hàng" }).click()
    await expect(preview).not.toContainText("Phí ship")

    await page.getByRole("radio", { name: "Xe / đơn vị vận chuyển" }).click()
    await expect(preview).not.toContainText("Phí ship")
  })
})

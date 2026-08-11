import { test, expect, type Locator, type Page } from "@playwright/test"

const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD

async function chooseSelect(page: Page, scope: Locator, label: string, option: string): Promise<void> {
  await scope.getByRole("combobox", { name: label }).click()
  await page.getByRole("option", { name: option, exact: true }).click()
}

function formatVnd(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)}đ`
}

async function readPreviewSubtotal(page: Page): Promise<number> {
  const row = page.locator(".invoice-summary > div").filter({ hasText: "Tiền hàng" })
  const text = await row.innerText()
  const amount = text.match(/([\d.]+)đ/)?.[1]
  if (!amount) throw new Error(`Could not read subtotal from preview row: ${text}`)
  return Number(amount.replace(/\./g, ""))
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
    const customerName = `E2E Customer ${Date.now()}`
    await page.getByLabel("Tên khách hàng").fill(customerName)
    await page.getByLabel("Số điện thoại").fill("0900000002")
    await page.getByLabel("Địa chỉ giao hàng").fill("Hà Nội")
    const orderSections = page.locator("fieldset")
    await expect(orderSections.nth(0)).toContainText("Thanh toán")
    await expect(orderSections.nth(1)).toContainText("Vận chuyển")
    await expect(orderSections.nth(2)).toContainText("Kho")
    await expect(orderSections.nth(3)).toContainText("Giảm giá")
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

    await page.goto("/invoices")
    const createdInvoiceRow = page.getByRole("row").filter({ hasText: customerName })
    await expect(createdInvoiceRow).toContainText("360.000đ")
    await expect(createdInvoiceRow).toContainText("Đã xác nhận")
  })

  test("hides the shipping fee row when paid shipping has no fee", async ({ page }) => {
    const preview = page.getByTestId("invoice-preview")

    await page.getByRole("radio", { name: "App giao hàng" }).click()
    await expect(preview).not.toContainText("Phí ship")

    await page.getByRole("radio", { name: "Xe / đơn vị vận chuyển" }).click()
    await expect(preview).not.toContainText("Phí ship")
  })

  async function chooseProduct(page: Page): Promise<void> {
    const productRow = page.locator(".product-row").first()
    await chooseSelect(page, productRow, "Tên sản phẩm", "Sản phẩm A")
    await chooseSelect(page, productRow, "Thể tích", "30ml")
    await chooseSelect(page, productRow, "Nồng độ", "10%")
    await productRow.getByLabel("Số lượng").fill("2")
  }

  test("creates and reopens an invoice with a percentage discount", async ({ page }) => {
    const customerName = `E2E Percentage ${Date.now()}`
    await page.getByLabel("Tên khách hàng").fill(customerName)
    await page.getByLabel("Số điện thoại").fill("0900000003")
    await page.getByLabel("Địa chỉ giao hàng").fill("Hà Nội")
    await chooseProduct(page)
    await page.getByRole("radio", { name: "Theo %" }).click()
    await page.getByLabel("Mức giảm (%)").fill("10")

    await expect(page.getByTestId("invoice-preview")).toContainText("Giảm giá (10%)")
    const subtotal = await readPreviewSubtotal(page)
    const discountAmount = Math.round(subtotal * 10 / 100)
    await expect(page.getByTestId("invoice-preview")).toContainText(`-${formatVnd(discountAmount)}`)
    await expect(page.getByTestId("invoice-preview")).toContainText(formatVnd(subtotal - discountAmount))
    await page.getByRole("button", { name: "Tạo hóa đơn" }).click()
    await expect(page.getByText("Đã lưu")).toBeVisible()

    await page.getByRole("button", { name: "Tạo đơn mới" }).click()
    await expect(page.getByRole("radio", { name: "Theo %" })).toHaveAttribute("aria-checked", "true")
    await expect(page.getByLabel("Mức giảm (%)")).toHaveValue("0")
    await expect(page.getByTestId("invoice-preview")).not.toContainText("Giảm giá")

    await page.goto("/invoices")
    const row = page.getByRole("row").filter({ hasText: customerName })
    await expect(row).toContainText(formatVnd(subtotal - discountAmount))
    await row.getByRole("link", { name: /HD-/ }).click()
    await expect(page).toHaveURL(/\/invoices\/[^/]+$/)
    await expect(page.getByTestId("invoice-preview")).toContainText("Giảm giá (10%)")
    await expect(page.getByTestId("invoice-preview")).toContainText(`-${formatVnd(discountAmount)}`)
  })

  test("creates an invoice with a fixed-amount discount", async ({ page }) => {
    const customerName = `E2E Amount ${Date.now()}`
    await page.getByLabel("Tên khách hàng").fill(customerName)
    await page.getByLabel("Số điện thoại").fill("0900000004")
    await page.getByLabel("Địa chỉ giao hàng").fill("Hà Nội")
    await chooseProduct(page)
    await page.getByRole("radio", { name: "Theo số tiền" }).click()
    await page.getByLabel("Mức giảm (đ)").fill("50000")

    await expect(page.getByTestId("invoice-preview")).toContainText("Giảm giá (50.000đ)")
    const subtotal = await readPreviewSubtotal(page)
    await expect(page.getByTestId("invoice-preview")).toContainText(formatVnd(subtotal - 50_000))
    await page.getByRole("button", { name: "Tạo hóa đơn" }).click()
    await expect(page.getByText("Đã lưu")).toBeVisible()
    await page.goto("/invoices")
    const row = page.getByRole("row").filter({ hasText: customerName })
    await expect(row).toContainText(formatVnd(subtotal - 50_000))
  })
})

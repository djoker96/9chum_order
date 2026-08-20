import { readFile } from "node:fs/promises"
import { expect, test, type Locator, type Page } from "@playwright/test"

const detailInvoice = {
  id: "export-e2e",
  invoiceNumber: "HD-12082026-0001",
  customerName: "Nguyễn Văn A",
  phone: "0901234567",
  address: "Hà Nội",
  warehouse: null,
  paymentMethod: "BANK_TRANSFER",
  shippingMethod: "FREE",
  shippingFee: 0,
  subtotal: 0,
  discountType: "PERCENTAGE",
  discountValue: 0,
  discountAmount: 0,
  total: 0,
  note: null,
  issueInvoice: false,
  companyName: null,
  invoiceAddress: null,
  invoiceEmail: null,
  status: "CONFIRMED",
  createdAt: "2026-08-12T00:00:00.000Z",
  updatedAt: "2026-08-12T00:00:00.000Z",
  items: [],
}

interface ImageBounds {
  width: number
  height: number
  left: number
  top: number
  right: number
  bottom: number
}

async function mockInvoiceApis(page: Page): Promise<void> {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { user: { role: "STAFF" } } }),
      status: 200,
    })
  })
  await page.route("**/api/products**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { products: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 } },
      }),
      status: 200,
    })
  })
  await page.route("**/api/invoices/export-e2e", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: { invoice: detailInvoice } }),
      status: 200,
    })
  })
}

async function readContentBounds(page: Page, png: Buffer): Promise<ImageBounds> {
  return page.evaluate(async (dataUrl) => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = reject
      element.src = dataUrl
    })
    const canvas = document.createElement("canvas")
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas context was not available")
    context.drawImage(image, 0, 0)

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    let left = canvas.width
    let top = canvas.height
    let right = -1
    let bottom = -1
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const offset = (y * canvas.width + x) * 4
        if (pixels[offset + 3] > 0 && Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]) < 220) {
          left = Math.min(left, x)
          top = Math.min(top, y)
          right = Math.max(right, x)
          bottom = Math.max(bottom, y)
        }
      }
    }
    if (right < 0) throw new Error("Export image had no visible content")
    return { bottom, height: canvas.height, left, right, top, width: canvas.width }
  }, `data:image/png;base64,${png.toString("base64")}`)
}

function expectSameContentBounds(preview: ImageBounds, exported: ImageBounds): void {
  for (const edge of ["left", "top", "right", "bottom"] as const) {
    const size = edge === "left" || edge === "right" ? "width" : "height"
    expect(Math.abs(preview[edge] / preview[size] - exported[edge] / exported[size])).toBeLessThan(0.01)
  }
}

async function exportAndCheck(page: Page, preview: Locator): Promise<void> {
  await expect(preview).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() => [...document.querySelectorAll("[data-testid='invoice-preview'] img")].every((image) => {
    const element = image as HTMLImageElement
    return element.complete && element.naturalWidth > 0
  }))

  const previewBox = await preview.boundingBox()
  if (!previewBox) throw new Error("Preview bounds were not available")
  expect(previewBox.height).toBe(926)
  const previewPng = await preview.screenshot()

  const [pngDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /PNG/ }).click(),
  ])
  expect(pngDownload.suggestedFilename()).toBe("hoa-don-nguyen-van-a.png")
  const pngPath = await pngDownload.path()
  if (!pngPath) throw new Error("PNG download path was not available")
  const png = await readFile(pngPath)
  expect(png.toString("ascii", 1, 4)).toBe("PNG")
  expect(png.readUInt32BE(16)).toBe(Math.ceil(previewBox.width) * 2)
  expect(png.readUInt32BE(20)).toBe(1852)
  expectSameContentBounds(await readContentBounds(page, previewPng), await readContentBounds(page, png))

  const [pdfDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /PDF/ }).click(),
  ])
  expect(pdfDownload.suggestedFilename()).toBe("hoa-don-nguyen-van-a.pdf")
  const pdfPath = await pdfDownload.path()
  if (!pdfPath) throw new Error("PDF download path was not available")
  const pdf = (await readFile(pdfPath)).toString("latin1")
  expect((pdf.match(/\/Type \/Page\b/g) ?? []).length).toBe(1)
}

test("exports preview-aligned PNG and PDF on create and detail pages", async ({ page }) => {
  await mockInvoiceApis(page)

  await test.step("create page", async () => {
    await page.goto("/invoices/create")
    await page.getByLabel("Tên khách hàng").fill("Nguyễn Văn A")
    await page.getByLabel("Số điện thoại").fill("0901234567")
    await page.getByLabel("Địa chỉ giao hàng").fill("Hà Nội")
    await exportAndCheck(page, page.getByTestId("invoice-preview"))
  })

  await test.step("detail page", async () => {
    await page.goto("/invoices/export-e2e")
    await exportAndCheck(page, page.getByTestId("invoice-preview"))
  })
})

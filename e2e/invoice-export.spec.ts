import { readFile } from "node:fs/promises"
import { expect, test } from "@playwright/test"

test("exports the rendered invoice preview without changing its dimensions", async ({ page }) => {
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

  await page.goto("/invoices/create")
  await page.getByLabel("Tên khách hàng").fill("Nguyễn Văn A")
  await page.getByLabel("Số điện thoại").fill("0901234567")
  await page.getByLabel("Địa chỉ giao hàng").fill("Hà Nội")

  const preview = page.getByTestId("invoice-preview")
  await expect(preview).toBeVisible()
  const previewBox = await preview.boundingBox()
  if (!previewBox) throw new Error("Preview bounds were not available")
  expect(previewBox.height).toBe(926)

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

  const [pdfDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /PDF/ }).click(),
  ])
  expect(pdfDownload.suggestedFilename()).toBe("hoa-don-nguyen-van-a.pdf")
  const pdfPath = await pdfDownload.path()
  if (!pdfPath) throw new Error("PDF download path was not available")
  const pdf = (await readFile(pdfPath)).toString("latin1")
  expect((pdf.match(/\/Type \/Page\b/g) ?? []).length).toBe(1)
})

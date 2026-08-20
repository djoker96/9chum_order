import { readFile } from "node:fs/promises"
import { expect, test, type Locator, type Page } from "@playwright/test"

const detailInvoice = {
  id: "export-e2e",
  invoiceNumber: "HD-12082026-0001",
  customerName: "Nguyễn Văn A",
  phone: "0901234567",
  address: "Hà Nội",
  warehouse: "L7-21",
  paymentMethod: "BANK_TRANSFER",
  shippingMethod: "DELIVERY_APP",
  shippingFee: 50_000,
  subtotal: 300_000,
  discountType: "PERCENTAGE",
  discountValue: 10,
  discountAmount: 30_000,
  total: 320_000,
  note: "Giao giờ hành chính",
  issueInvoice: true,
  companyName: "CTCP 9CHUM",
  invoiceAddress: "Hà Nội",
  invoiceEmail: "ketoan@9chum.vn",
  items: [{ productName: "Rượu mơ rừng", volume: "3 lít", concentration: "25%", quantity: 2, unitPrice: 150_000, lineTotal: 300_000 }],
  status: "CONFIRMED",
  createdAt: "2026-08-12T00:00:00.000Z",
  updatedAt: "2026-08-12T00:00:00.000Z",
}

interface ImageBounds {
  width: number
  height: number
  left: number
  top: number
  right: number
  bottom: number
}

interface ImageRegion {
  left: number
  top: number
  width: number
  height: number
}

interface PdfImage {
  width: number
  height: number
  rgb: Buffer
}

type ExportImage =
  | { kind: "png"; dataUrl: string }
  | { kind: "rgb"; width: number; height: number; data: string }

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

function relativeImageRegion(parent: { x: number; y: number }, image: { x: number; y: number; width: number; height: number }): ImageRegion {
  return { height: image.height, left: image.x - parent.x, top: image.y - parent.y, width: image.width }
}

function readPdfImage(pdf: Buffer): PdfImage {
  const source = pdf.toString("latin1")
  const imageStart = source.indexOf("/Subtype /Image")
  if (imageStart < 0) throw new Error("PDF did not contain an image XObject")
  const header = source.slice(imageStart, imageStart + 1_000)
  const width = Number(header.match(/\/Width\s+(\d+)/)?.[1])
  const height = Number(header.match(/\/Height\s+(\d+)/)?.[1])
  const length = Number(header.match(/\/Length\s+(\d+)/)?.[1])
  if (!width || !height || !length) throw new Error("PDF image metadata was incomplete")

  const streamIndex = source.indexOf("stream", imageStart)
  if (streamIndex < 0) throw new Error("PDF image stream was missing")
  const streamStart = source[streamIndex + 6] === "\r" ? streamIndex + 8 : streamIndex + 7
  const rgb = pdf.subarray(streamStart, streamStart + length)
  if (rgb.length !== width * height * 3) throw new Error("PDF image was not an unfiltered RGB stream")
  return { height, rgb, width }
}

async function measureRegionDifference(page: Page, previewPng: Buffer, actual: ExportImage, region: ImageRegion): Promise<number> {
  return page.evaluate(async ({ actual, previewDataUrl, region }) => {
    async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
      return new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = reject
        image.src = dataUrl
      })
    }

    const previewImage = await loadImage(previewDataUrl)
    const previewCanvas = document.createElement("canvas")
    previewCanvas.width = previewImage.naturalWidth
    previewCanvas.height = previewImage.naturalHeight
    const previewContext = previewCanvas.getContext("2d")
    if (!previewContext) throw new Error("Preview canvas context was not available")
    previewContext.drawImage(previewImage, 0, 0)

    const actualCanvas = document.createElement("canvas")
    if (actual.kind === "png") {
      const actualImage = await loadImage(actual.dataUrl)
      actualCanvas.width = actualImage.naturalWidth
      actualCanvas.height = actualImage.naturalHeight
      const actualContext = actualCanvas.getContext("2d")
      if (!actualContext) throw new Error("PNG canvas context was not available")
      actualContext.drawImage(actualImage, 0, 0)
    } else {
      actualCanvas.width = actual.width
      actualCanvas.height = actual.height
      const actualContext = actualCanvas.getContext("2d")
      if (!actualContext) throw new Error("PDF canvas context was not available")
      const rgb = Uint8Array.from(atob(actual.data), (character) => character.charCodeAt(0))
      const pixels = new Uint8ClampedArray(actual.width * actual.height * 4)
      for (let source = 0, target = 0; source < rgb.length; source += 3, target += 4) {
        pixels[target] = rgb[source]
        pixels[target + 1] = rgb[source + 1]
        pixels[target + 2] = rgb[source + 2]
        pixels[target + 3] = 255
      }
      actualContext.putImageData(new ImageData(pixels, actual.width, actual.height), 0, 0)
    }

    const previewPixels = previewContext.getImageData(0, 0, previewCanvas.width, previewCanvas.height).data
    const actualContext = actualCanvas.getContext("2d")
    if (!actualContext) throw new Error("Export canvas context was not available")
    if (!previewCanvas.width || !previewCanvas.height || !actualCanvas.width || !actualCanvas.height) {
      throw new Error(`Canvas dimensions were invalid: preview=${previewCanvas.width}x${previewCanvas.height}, export=${actualCanvas.width}x${actualCanvas.height}`)
    }
    const actualPixels = actualContext.getImageData(0, 0, actualCanvas.width, actualCanvas.height).data
    const startX = Math.max(0, Math.floor(region.left))
    const startY = Math.max(0, Math.floor(region.top))
    const endX = Math.min(previewCanvas.width, Math.ceil(region.left + region.width))
    const endY = Math.min(previewCanvas.height, Math.ceil(region.top + region.height))
    if (endX <= startX || endY <= startY) {
      throw new Error(`Image region was outside preview: ${JSON.stringify(region)} in ${previewCanvas.width}x${previewCanvas.height}`)
    }
    const step = Math.max(1, Math.floor(Math.max(region.width, region.height) / 180))
    let totalDifference = 0
    let samples = 0

    for (let y = startY; y < endY; y += step) {
      for (let x = startX; x < endX; x += step) {
        const previewOffset = (y * previewCanvas.width + x) * 4
        const actualX = Math.min(actualCanvas.width - 1, Math.floor((x + 0.5) * actualCanvas.width / previewCanvas.width))
        const actualY = Math.min(actualCanvas.height - 1, Math.floor((y + 0.5) * actualCanvas.height / previewCanvas.height))
        const actualOffset = (actualY * actualCanvas.width + actualX) * 4
        totalDifference += Math.abs(previewPixels[previewOffset] - actualPixels[actualOffset])
          + Math.abs(previewPixels[previewOffset + 1] - actualPixels[actualOffset + 1])
          + Math.abs(previewPixels[previewOffset + 2] - actualPixels[actualOffset + 2])
        samples += 3
      }
    }

    return totalDifference / samples
  }, {
    actual: actual.kind === "png"
      ? actual
      : { data: actual.data.toString(), height: actual.height, kind: actual.kind, width: actual.width },
    previewDataUrl: `data:image/png;base64,${previewPng.toString("base64")}`,
    region,
  })
}

async function expectAssetMatchesPreview(
  page: Page,
  previewPng: Buffer,
  previewBox: { x: number; y: number },
  image: Locator,
  actual: ExportImage,
  name: string,
): Promise<void> {
  const imageBox = await image.boundingBox()
  if (!imageBox) throw new Error(`${name} bounds were not available`)
  const difference = await measureRegionDifference(page, previewPng, actual, relativeImageRegion(previewBox, imageBox))
  expect(difference, `${name} in export differs from the preview`).toBeLessThan(25)
}

async function exportAndCheck(page: Page, preview: Locator): Promise<void> {
  await expect(preview).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() => [...document.querySelectorAll("[data-testid='invoice-preview'] img")].every((image) => {
    const element = image as HTMLImageElement
    return element.complete && element.naturalWidth > 0
  }))

  const previewPng = await preview.screenshot()
  const previewBox = await preview.boundingBox()
  if (!previewBox) throw new Error("Preview bounds were not available")
  expect(previewBox.height).toBe(926)
  const watermark = preview.locator("img").first()
  const qr = preview.getByAltText("Mã QR thanh toán Techcombank")

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
  const pngImage: ExportImage = { dataUrl: `data:image/png;base64,${png.toString("base64")}`, kind: "png" }
  await expectAssetMatchesPreview(page, previewPng, previewBox, watermark, pngImage, "Watermark")
  await expectAssetMatchesPreview(page, previewPng, previewBox, qr, pngImage, "QR")

  const [pdfDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /PDF/ }).click(),
  ])
  expect(pdfDownload.suggestedFilename()).toBe("hoa-don-nguyen-van-a.pdf")
  const pdfPath = await pdfDownload.path()
  if (!pdfPath) throw new Error("PDF download path was not available")
  const pdf = await readFile(pdfPath)
  const pdfText = pdf.toString("latin1")
  expect((pdfText.match(/\/Type \/Page\b/g) ?? []).length).toBe(1)
  const pdfImage = readPdfImage(pdf)
  expect(pdfImage.width).toBe(png.readUInt32BE(16))
  expect(pdfImage.height).toBe(png.readUInt32BE(20))
  const pdfExportImage: ExportImage = {
    data: pdfImage.rgb.toString("base64"),
    height: pdfImage.height,
    kind: "rgb",
    width: pdfImage.width,
  }
  await expectAssetMatchesPreview(page, previewPng, previewBox, watermark, pdfExportImage, "Watermark in PDF")
  await expectAssetMatchesPreview(page, previewPng, previewBox, qr, pdfExportImage, "QR in PDF")
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

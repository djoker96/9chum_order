export const INVOICE_EXPORT_PIXEL_RATIO = 2

const A4_PAGE_WIDTH_MM = 210
const A4_PAGE_HEIGHT_MM = 297
const PDF_MARGIN_MM = 10
const MAX_SINGLE_PAGE_ASPECT_RATIO = 2.5

export interface PdfImagePage {
  sourceY: number
  sourceHeight: number
  x: number
  y: number
  width: number
  height: number
}

export interface PdfPageLayout {
  pages: PdfImagePage[]
}

export interface InvoiceCaptureOptions {
  backgroundColor: string
  cacheBust: boolean
  height: number
  includeQueryParams: boolean
  pixelRatio: number
  style: Partial<CSSStyleDeclaration>
  width: number
}

export function getInvoiceCaptureOptions(node: HTMLElement): InvoiceCaptureOptions {
  const bounds = node.getBoundingClientRect()
  const width = Math.max(1, Math.ceil(bounds.width || node.clientWidth))
  const height = Math.max(1, Math.ceil(bounds.height || node.clientHeight))

  return {
    backgroundColor: "#ffffff",
    cacheBust: true,
    height,
    includeQueryParams: true,
    pixelRatio: INVOICE_EXPORT_PIXEL_RATIO,
    style: {
      height: `${height}px`,
      margin: "0",
      width: `${width}px`,
    },
    width,
  }
}

export async function waitForInvoicePreviewReady(node: HTMLElement): Promise<void> {
  const fontReady = typeof document !== "undefined" && document.fonts
    ? document.fonts.ready.catch(() => undefined)
    : Promise.resolve()
  const imageReady = Array.from(node.querySelectorAll("img")).map(waitForImage)

  await Promise.all([fontReady, ...imageReady])
}

export function calculatePdfPageLayout(
  imageWidth: number,
  imageHeight: number,
  pageWidth = A4_PAGE_WIDTH_MM,
  pageHeight = A4_PAGE_HEIGHT_MM,
  margin = PDF_MARGIN_MM,
): PdfPageLayout {
  if (imageWidth <= 0 || imageHeight <= 0) {
    throw new Error("Invoice export image dimensions must be positive.")
  }

  const contentWidth = pageWidth - margin * 2
  const contentHeight = pageHeight - margin * 2
  const aspectRatio = imageWidth / imageHeight
  const imageAspectRatio = imageHeight / imageWidth
  const fitsAsOnePage = imageAspectRatio <= MAX_SINGLE_PAGE_ASPECT_RATIO
  const renderWidth = fitsAsOnePage
    ? Math.min(contentWidth, contentHeight * aspectRatio)
    : contentWidth
  const renderHeight = renderWidth / aspectRatio

  if (fitsAsOnePage) {
    return {
      pages: [{
        height: renderHeight,
        sourceHeight: imageHeight,
        sourceY: 0,
        width: renderWidth,
        x: (pageWidth - renderWidth) / 2,
        y: (pageHeight - renderHeight) / 2,
      }],
    }
  }

  const sourcePageHeight = Math.max(1, Math.floor(contentHeight / renderWidth * imageWidth))
  const pages: PdfImagePage[] = []
  let sourceY = 0

  while (sourceY < imageHeight) {
    const sourceHeight = Math.min(sourcePageHeight, imageHeight - sourceY)
    pages.push({
      height: sourceHeight / imageWidth * renderWidth,
      sourceHeight,
      sourceY,
      width: renderWidth,
      x: margin,
      y: margin,
    })
    sourceY += sourceHeight
  }

  return { pages }
}

export function cropInvoiceImage(image: HTMLImageElement, page: PdfImagePage): string {
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = Math.max(1, Math.round(page.sourceHeight))
  const canvas = document.createElement("canvas")
  canvas.width = sourceWidth
  canvas.height = sourceHeight
  const context = canvas.getContext("2d")

  if (!context) throw new Error("Could not create an invoice export canvas.")

  context.drawImage(
    image,
    0,
    page.sourceY,
    sourceWidth,
    page.sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight,
  )

  return canvas.toDataURL("image/png")
}

function waitForImage(image: HTMLImageElement): Promise<void> {
  if (image.complete) return Promise.resolve()

  return new Promise((resolve) => {
    const settle = () => {
      image.removeEventListener("load", settle)
      image.removeEventListener("error", settle)
      resolve()
    }
    image.addEventListener("load", settle, { once: true })
    image.addEventListener("error", settle, { once: true })
  })
}

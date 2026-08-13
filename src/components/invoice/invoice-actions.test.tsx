import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useRef } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { InvoiceActions } from "@/components/invoice/invoice-actions"
import { calculatePdfPageLayout } from "@/components/invoice/invoice-export"
import type { InvoiceOutputData } from "@/lib/invoice-text"

const mocks = vi.hoisted(() => ({
  toPng: vi.fn(),
  jsPDF: vi.fn(),
  addImage: vi.fn(),
  addPage: vi.fn(),
  save: vi.fn(),
}))

vi.mock("html-to-image", () => ({ toPng: mocks.toPng }))
vi.mock("jspdf", () => ({ jsPDF: mocks.jsPDF }))

const invoice: InvoiceOutputData = {
  invoiceNumber: "HD-12082026-0001",
  customerName: "Nguyễn Văn A",
  phone: "0901234567",
  address: "Hà Nội",
  warehouse: null,
  paymentMethod: "BANK_TRANSFER",
  shippingMethod: "FREE",
  shippingFee: 0,
  subtotal: 300_000,
  discountType: "PERCENTAGE",
  discountValue: 0,
  discountAmount: 0,
  total: 300_000,
  note: null,
  issueInvoice: false,
  companyName: null,
  invoiceAddress: null,
  invoiceEmail: null,
  items: [],
}

function ActionHarness() {
  const targetRef = useRef<HTMLElement>(null)

  return (
    <>
      <article ref={targetRef} style={{ height: "926px", width: "500px" }} />
      <InvoiceActions invoice={invoice} targetRef={targetRef} />
    </>
  )
}

describe("InvoiceActions export", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.toPng.mockResolvedValue("data:image/png;base64,invoice")
    mocks.jsPDF.mockImplementation(() => ({
      addImage: mocks.addImage,
      addPage: mocks.addPage,
      internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
      save: mocks.save,
    }))
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("captures the same rendered preview size with cache and font-safe options", async () => {
    render(<ActionHarness />)
    const preview = document.querySelector("article") as HTMLElement
    vi.spyOn(preview, "getBoundingClientRect").mockReturnValue({
      bottom: 926,
      height: 926,
      left: 0,
      right: 500,
      top: 0,
      width: 500,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    fireEvent.click(screen.getByRole("button", { name: /PNG/ }))

    await waitFor(() => expect(mocks.toPng).toHaveBeenCalledTimes(1))
    expect(mocks.toPng).toHaveBeenCalledWith(preview, expect.objectContaining({
      backgroundColor: "#ffffff",
      cacheBust: true,
      height: 926,
      pixelRatio: 2,
      width: 500,
    }))
  })

  it("waits for preview images before capturing", async () => {
    render(<ActionHarness />)
    const preview = document.querySelector("article") as HTMLElement
    const image = document.createElement("img")
    preview.appendChild(image)
    Object.defineProperty(image, "complete", { configurable: true, value: false })

    fireEvent.click(screen.getByRole("button", { name: /PNG/ }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mocks.toPng).not.toHaveBeenCalled()

    fireEvent.load(image)
    await waitFor(() => expect(mocks.toPng).toHaveBeenCalledTimes(1))
  })

  it("fits the normal invoice preview on one A4 page without stretching it", async () => {
    class LoadedImage {
      width = 1000
      height = 1852
      onload: (() => void) | null = null
      onerror: (() => void) | null = null

      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal("Image", LoadedImage)

    render(<ActionHarness />)
    fireEvent.click(screen.getByRole("button", { name: /PDF/ }))

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    expect(mocks.addPage).not.toHaveBeenCalled()
    expect(mocks.addImage).toHaveBeenCalledTimes(1)
    expect(mocks.addImage).toHaveBeenCalledWith(
      "data:image/png;base64,invoice",
      "PNG",
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    )
  })

  it("calculates complete slices for a tall export", () => {
    const layout = calculatePdfPageLayout(1000, 4000)

    expect(layout.pages.length).toBeGreaterThan(1)
    expect(layout.pages.reduce((total, page) => total + page.sourceHeight, 0)).toBe(4000)
  })
})

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { InvoicePreview } from "@/components/invoice/invoice-preview"
import type { InvoiceOutputData } from "@/lib/invoice-text"

const invoice: InvoiceOutputData = {
  customerName: "Nguyễn Văn A",
  phone: "0901234567",
  address: "Hà Nội",
  warehouse: null,
  paymentMethod: "BANK_TRANSFER",
  shippingMethod: "DELIVERY_APP",
  shippingFee: 50_000,
  subtotal: 300_000,
  discountType: "PERCENTAGE",
  discountValue: 10,
  discountAmount: 30_000,
  total: 320_000,
  note: null,
  issueInvoice: false,
  companyName: null,
  invoiceAddress: null,
  invoiceEmail: null,
  items: [],
}

describe("InvoicePreview", () => {
  it("renders the discount after goods total and before shipping", () => {
    render(<InvoicePreview invoice={invoice} />)

    const summary = screen.getByTestId("invoice-preview").querySelector(".invoice-summary")
    expect(summary).not.toBeNull()
    expect(summary?.textContent).toContain("Tiền hàng")
    expect(summary?.textContent).toContain("Giảm giá (10%)")
    expect(summary?.textContent).toContain("-30.000đ")
    expect(summary?.textContent).toContain("Phí ship")
    expect(summary?.textContent?.indexOf("Giảm giá")).toBeGreaterThan(summary?.textContent?.indexOf("Tiền hàng") ?? -1)
  })

  it("does not render a discount row when nothing is discounted", () => {
    render(<InvoicePreview invoice={{ ...invoice, discountValue: 0, discountAmount: 0, total: 350_000 }} />)

    expect(screen.getByTestId("invoice-preview").textContent).not.toContain("Giảm giá")
  })
})

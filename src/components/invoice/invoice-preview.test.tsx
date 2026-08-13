import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { InvoicePreview } from "@/components/invoice/invoice-preview"
import type { InvoiceOutputData } from "@/lib/invoice-text"

const invoice: InvoiceOutputData = {
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
}

describe("InvoicePreview", () => {
  it("renders the Figma header, order number, product and summary rows", () => {
    render(<InvoicePreview invoice={invoice} />)

    expect(screen.getByRole("heading", { name: "ĐƠN HÀNG" })).toBeVisible()
    expect(screen.getByText("HD-12082026-0001")).toBeVisible()
    expect(screen.getByText("2 x Rượu mơ rừng")).toBeVisible()
    expect(screen.getByText("3 lít - 25 độ")).toBeVisible()

    const summary = screen.getByTestId("invoice-preview").querySelector(".invoice-summary")
    expect(summary).not.toBeNull()
    expect(summary?.textContent).toContain("Tiền hàng")
    expect(summary?.textContent).toContain("Giảm giá (10%)")
    expect(summary?.textContent).toContain("-30.000đ")
    expect(summary?.textContent).toContain("Phí ship")
    expect(summary?.textContent).toContain("Xuất kho")
    expect(summary?.textContent).toContain("Ghi chú")
    expect(summary?.textContent?.indexOf("Giảm giá")).toBeGreaterThan(summary?.textContent?.indexOf("Tiền hàng") ?? -1)
  })

  it("uses a placeholder for an invoice number that has not been created", () => {
    render(<InvoicePreview invoice={{ ...invoice, invoiceNumber: undefined }} />)

    expect(screen.getByText("—")).toBeVisible()
  })

  it("renders the payment QR and fixed transfer details only for bank transfers", () => {
    const { rerender } = render(<InvoicePreview invoice={invoice} />)

    expect(screen.getByLabelText("Thông tin chuyển khoản")).toHaveTextContent("Ngân hàng Techcombank")
    expect(screen.getByText("CTCP THUONG MAI DOUBLE K")).toBeVisible()
    expect(screen.getByAltText("Mã QR thanh toán Techcombank")).toBeVisible()

    rerender(<InvoicePreview invoice={{ ...invoice, paymentMethod: "COD" }} />)
    expect(screen.queryByLabelText("Thông tin chuyển khoản")).not.toBeInTheDocument()
    expect(screen.queryByAltText("Mã QR thanh toán Techcombank")).not.toBeInTheDocument()
  })

  it("keeps conditional rows and empty state clear", () => {
    render(<InvoicePreview invoice={{ ...invoice, items: [], issueInvoice: false, discountValue: 0, discountAmount: 0, shippingMethod: "FREE", shippingFee: 0, warehouse: null, note: null }} />)

    const preview = screen.getByTestId("invoice-preview")
    expect(screen.getByText("Chưa có sản phẩm")).toBeVisible()
    expect(preview).not.toHaveTextContent("Giảm giá")
    expect(preview).not.toHaveTextContent("Phí ship")
    expect(preview).not.toHaveTextContent("Xuất kho")
    expect(preview).not.toHaveTextContent("Thông tin xuất hóa đơn")
  })
})

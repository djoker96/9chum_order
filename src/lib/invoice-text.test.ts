import { describe, expect, it } from "vitest"
import { buildInvoicePlainText, safeInvoiceFileName } from "@/lib/invoice-text"

const invoice = {
  invoiceNumber: "HD-10082026-0001",
  customerName: "Nguyễn Văn A",
  phone: "0901234567",
  address: "Hà Nội",
  paymentMethod: "BANK_TRANSFER",
  shippingMethod: "DELIVERY_APP",
  shippingFee: 50000,
  subtotal: 300000,
  discountType: "PERCENTAGE" as const,
  discountValue: 0,
  discountAmount: 0,
  total: 350000,
  note: "Giao sau 18h",
  issueInvoice: false,
  companyName: null,
  invoiceAddress: null,
  invoiceEmail: null,
  items: [{ productName: "Sản phẩm A", volume: "30ml", concentration: "10%", unitPrice: 150000, quantity: 2, lineTotal: 300000 }],
}

describe("invoice output helpers", () => {
  it("builds Vietnamese plain text for chat apps", () => {
    const text = buildInvoicePlainText(invoice)

    expect(text).toContain("Khách hàng: Nguyễn Văn A")
    expect(text).toContain("150.000đ × 2 = 300.000đ")
    expect(text).toContain("Tổng cộng: 350.000đ")
    expect(text).not.toContain("undefined")
  })

  it("formats copied invoice items as compact lines with separators", () => {
    const text = buildInvoicePlainText({
      ...invoice,
      invoiceNumber: undefined,
      customerName: "Đạt Trần",
      phone: "0979827896",
      address: "L7-22 Đại Kim, Hoàng Mai",
      warehouse: "L7-22",
      paymentMethod: "COD",
      shippingFee: 0,
      subtotal: 680000,
      discountValue: 0,
      discountAmount: 0,
      total: 680000,
      note: "abc",
      items: [
        { productName: "Sản phẩm A", volume: "30ml", concentration: "10%", unitPrice: 180000, quantity: 1, lineTotal: 180000 },
        { productName: "Sản phẩm B", volume: "50ml", concentration: "20%", unitPrice: 250000, quantity: 2, lineTotal: 500000 },
      ],
    })

    expect(text).toBe([
      "Khách hàng: Đạt Trần",
      "SĐT: 0979827896",
      "Địa chỉ: L7-22 Đại Kim, Hoàng Mai",
      "Kho: L7-22",
      "--------------------",
      "- 1 Sản phẩm A - 30ml - 10 độ: 180.000đ × 1 = 180.000đ",
      "- 2 Sản phẩm B - 50ml - 20 độ: 250.000đ × 2 = 500.000đ",
      "--------------------",
      "Tiền hàng: 680.000đ",
      "Thanh toán: COD",
      "Vận chuyển: Ship qua app giao hàng",
      "Phí ship: 0đ",
      "Ghi chú: abc",
      "--------------------",
      "Tổng cộng: 680.000đ",
    ].join("\n"))
  })

  it("sanitizes customer names for downloaded filenames", () => {
    expect(safeInvoiceFileName("Nguyễn Văn A / VIP", "png")).toBe("hoa-don-nguyen-van-a-vip.png")
    expect(safeInvoiceFileName("", "pdf")).toBe("hoa-don-khach-hang.pdf")
  })

  it("includes free shipping and VAT information when present", () => {
    const text = buildInvoicePlainText({
      ...invoice,
      shippingMethod: "FREE",
      shippingFee: 0,
      issueInvoice: true,
      companyName: "ABC Company",
      invoiceAddress: "Hà Nội",
      invoiceEmail: "invoice@example.com",
    })

    expect(text).toContain("Vận chuyển: Free ship")
    expect(text).toContain("Tên đơn vị: ABC Company")
  })

  it("includes the selected discount method, value, and deducted amount", () => {
    const percentageText = buildInvoicePlainText({
      ...invoice,
      discountType: "PERCENTAGE",
      discountValue: 10,
      discountAmount: 30000,
      total: 320000,
    })
    const amountText = buildInvoicePlainText({
      ...invoice,
      discountType: "AMOUNT",
      discountValue: 50000,
      discountAmount: 50000,
      total: 300000,
    })

    expect(percentageText).toContain("Giảm giá (theo %): 10% (-30.000đ)")
    expect(amountText).toContain("Giảm giá (theo số tiền): 50.000đ (-50.000đ)")
    expect(percentageText.indexOf("Giảm giá")).toBeGreaterThan(percentageText.indexOf("Tiền hàng"))
  })

  it("hides the discount line when the discount value is zero", () => {
    expect(buildInvoicePlainText(invoice)).not.toContain("Giảm giá")
  })
})

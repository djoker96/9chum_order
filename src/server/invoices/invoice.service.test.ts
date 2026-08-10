import { describe, expect, it } from "vitest"
import { resolveInvoiceDraft, type InvoiceProduct } from "@/server/invoices/invoice.service"

const products: InvoiceProduct[] = [
  { id: "product-1", name: "Sản phẩm A", volume: "30ml", concentration: "10%", price: 150000, isActive: true },
  { id: "product-2", name: "Sản phẩm B", volume: "50ml", concentration: "20%", price: 250000, isActive: true },
]

const input = {
  customerName: "Nguyễn Văn A",
  phone: "0901234567",
  address: "Hà Nội",
  items: [{ productId: "product-1", quantity: 2 }],
  paymentMethod: "BANK_TRANSFER" as const,
  shippingMethod: "DELIVERY_APP" as const,
  shippingFee: 50000,
  issueInvoice: false,
  invoiceInfo: undefined,
}

describe("resolveInvoiceDraft", () => {
  it("uses database prices and builds historical item snapshots", () => {
    const result = resolveInvoiceDraft(input, products)

    expect(result.items).toEqual([
      {
        productId: "product-1",
        productName: "Sản phẩm A",
        volume: "30ml",
        concentration: "10%",
        unitPrice: 150000,
        quantity: 2,
        lineTotal: 300000,
      },
    ])
    expect(result.subtotal).toBe(300000)
    expect(result.total).toBe(350000)
  })

  it("normalizes free shipping regardless of a client-provided fee", () => {
    const result = resolveInvoiceDraft({ ...input, shippingMethod: "FREE", shippingFee: 50000 }, products)

    expect(result.shippingFee).toBe(0)
    expect(result.total).toBe(300000)
  })

  it("keeps the optional warehouse on the invoice draft", () => {
    const result = resolveInvoiceDraft({ ...input, warehouse: "L7-22" }, products)

    expect(result).toMatchObject({ warehouse: "L7-22" })
  })

  it("rejects unavailable products instead of creating a partial invoice", () => {
    expect(() => resolveInvoiceDraft({ ...input, items: [{ productId: "missing", quantity: 1 }] }, products)).toThrow("Product không tồn tại hoặc đã ngừng bán")
  })
})

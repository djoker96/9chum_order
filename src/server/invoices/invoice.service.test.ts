import { beforeEach, describe, expect, it, vi } from "vitest"
import { AppError } from "@/server/http/api"
import { resolveInvoiceDraft, serializeInvoice, updateInvoice, type InvoiceProduct } from "@/server/invoices/invoice.service"

const prismaMocks = vi.hoisted(() => ({
  findInvoice: vi.fn(),
  findProducts: vi.fn(),
  updateInvoice: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    invoice: { findUnique: prismaMocks.findInvoice, update: prismaMocks.updateInvoice },
    product: { findMany: prismaMocks.findProducts },
  },
}))

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
  discountType: "PERCENTAGE" as const,
  discountValue: 0,
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
    expect(result.discountAmount).toBe(0)
    expect(result.total).toBe(350000)
  })

  it("calculates the discount from the database-backed product price", () => {
    const result = resolveInvoiceDraft({ ...input, discountType: "PERCENTAGE", discountValue: 10 }, products)

    expect(result.subtotal).toBe(300000)
    expect(result.discountAmount).toBe(30000)
    expect(result.total).toBe(320000)
  })

  it("rejects a fixed discount above the database subtotal with a 400 error", () => {
    let caught: unknown
    try {
      resolveInvoiceDraft({ ...input, discountType: "AMOUNT", discountValue: 300001 }, products)
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(AppError)
    expect(caught).toMatchObject({ status: 400, code: "DISCOUNT_EXCEEDS_SUBTOTAL" })
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

  it("serializes discount fields and decimal-like money values", () => {
    const result = serializeInvoice({
      id: "invoice-1",
      invoiceNumber: "HD-10082026-0001",
      customerName: "Nguyễn Văn A",
      phone: "0901234567",
      address: "Hà Nội",
      warehouse: null,
      paymentMethod: "BANK_TRANSFER",
      shippingMethod: "DELIVERY_APP",
      shippingFee: "50000",
      subtotal: "300000",
      discountType: "PERCENTAGE",
      discountValue: "10",
      discountAmount: "30000",
      total: "320000",
      note: null,
      issueInvoice: false,
      companyName: null,
      invoiceAddress: null,
      invoiceEmail: null,
      status: "CONFIRMED",
      createdAt: new Date("2026-08-10T00:00:00.000Z"),
      updatedAt: new Date("2026-08-10T00:00:00.000Z"),
      items: [],
    })

    expect(result).toMatchObject({
      discountType: "PERCENTAGE",
      discountValue: 10,
      discountAmount: 30000,
      total: 320000,
    })
  })
})

describe("updateInvoice", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMocks.findInvoice.mockResolvedValue({
      items: [
        { id: "item-1", productId: "product-1", productName: "Sản phẩm A", volume: "30ml", concentration: "10%", unitPrice: 150000 },
        { id: "item-2", productId: null, productName: "Sản phẩm đã xóa", volume: "50ml", concentration: "20%", unitPrice: 80000 },
      ],
    })
    prismaMocks.findProducts.mockResolvedValue([
      { id: "product-1", name: "Sản phẩm A giá mới", volume: "30ml", concentration: "10%", price: 200000, isActive: true },
    ])
    prismaMocks.updateInvoice.mockResolvedValue({
      id: "invoice-1",
      invoiceNumber: "HD-20082026-0001",
      customerName: "Khách mới",
      phone: "0901234567",
      address: "Hà Nội",
      warehouse: null,
      paymentMethod: "BANK_TRANSFER",
      shippingMethod: "FREE",
      shippingFee: 0,
      subtotal: 380000,
      discountType: "PERCENTAGE",
      discountValue: 0,
      discountAmount: 0,
      total: 380000,
      note: null,
      issueInvoice: false,
      companyName: null,
      invoiceAddress: null,
      invoiceEmail: null,
      status: "CONFIRMED",
      createdAt: new Date("2026-08-20T00:00:00.000Z"),
      updatedAt: new Date("2026-08-20T01:00:00.000Z"),
      createdBy: { id: "admin-1", name: "Admin" },
      items: [],
    })
  })

  it("preserves historical snapshots for existing and deleted products", async () => {
    const result = await updateInvoice("invoice-1", {
      ...input,
      customerName: "Khách mới",
      shippingMethod: "FREE",
      shippingFee: 0,
      items: [
        { productId: "product-1", quantity: 2 },
        { invoiceItemId: "item-2", quantity: 1 },
      ],
    })

    expect(result.total).toBe(380000)
    expect(prismaMocks.updateInvoice).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        subtotal: 380000,
        total: 380000,
        items: {
          deleteMany: {},
          create: [
            expect.objectContaining({ productId: "product-1", productName: "Sản phẩm A", unitPrice: 150000, lineTotal: 300000 }),
            expect.objectContaining({ productId: null, productName: "Sản phẩm đã xóa", unitPrice: 80000, lineTotal: 80000 }),
          ],
        },
      }),
    }))
  })
})

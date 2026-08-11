import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { AppError } from "@/server/http/api"
import { POST } from "@/app/api/invoices/route"
import { createInvoice, serializeInvoice } from "@/server/invoices/invoice.service"
import { requireUser } from "@/server/auth/session"

vi.mock("@/server/auth/session", () => ({
  requireUser: vi.fn(),
}))

vi.mock("@/server/http/security", () => ({
  assertApiRateLimit: vi.fn(),
  assertSameOrigin: vi.fn(),
}))

vi.mock("@/server/invoices/invoice.service", () => ({
  createInvoice: vi.fn(),
  serializeInvoice: vi.fn((invoice: unknown) => invoice),
}))

const currentUser = { id: "staff-1", email: "staff@example.com", name: "Staff", role: "STAFF" as const }
const validPayload = {
  customerName: "Nguyễn Văn A",
  phone: "0901234567",
  address: "Hà Nội",
  items: [{ productId: "product-1", quantity: 1 }],
  paymentMethod: "BANK_TRANSFER" as const,
  shippingMethod: "DELIVERY_APP" as const,
  shippingFee: 50_000,
  issueInvoice: false,
}

describe("POST /api/invoices", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireUser).mockResolvedValue(currentUser)
    vi.mocked(createInvoice).mockResolvedValue({ id: "invoice-1" } as never)
  })

  it("defaults to no discount", async () => {
    const response = await POST(new NextRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validPayload),
    }))

    expect(response.status).toBe(201)
    expect(createInvoice).toHaveBeenCalledWith({
      ...validPayload,
      invoiceInfo: undefined,
      discountType: "PERCENTAGE",
      discountValue: 0,
    }, currentUser.id)
  })

  it.each([
    ["PERCENTAGE", 10],
    ["AMOUNT", 50_000],
  ] as const)("accepts %s discounts", async (discountType, discountValue) => {
    const response = await POST(new NextRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...validPayload, discountType, discountValue }),
    }))

    expect(response.status).toBe(201)
    expect(createInvoice).toHaveBeenCalledWith(expect.objectContaining({ discountType, discountValue }), currentUser.id)
  })

  it("returns a field validation error for a percentage above 100", async () => {
    const response = await POST(new NextRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...validPayload, discountType: "PERCENTAGE", discountValue: 101 }),
    }))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error.fields.discountValue).toBeDefined()
    expect(createInvoice).not.toHaveBeenCalled()
  })

  it("preserves the service 400 for a fixed discount above subtotal", async () => {
    vi.mocked(createInvoice).mockRejectedValue(new AppError(400, "DISCOUNT_EXCEEDS_SUBTOTAL", "Tiền giảm không được vượt quá tiền hàng."))

    const response = await POST(new NextRequest("http://localhost:3000/api/invoices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...validPayload, discountType: "AMOUNT", discountValue: 999_999 }),
    }))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error.code).toBe("DISCOUNT_EXCEEDS_SUBTOTAL")
  })
})

import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { DELETE, PATCH } from "@/app/api/invoices/[id]/route"
import { requireAdmin } from "@/server/auth/session"
import { deleteInvoice } from "@/server/invoices/invoice.repository"
import { updateInvoice } from "@/server/invoices/invoice.service"

vi.mock("@/server/auth/session", () => ({
  requireAdmin: vi.fn(),
  requireUser: vi.fn(),
}))

vi.mock("@/server/http/security", () => ({
  assertApiRateLimit: vi.fn(),
  assertSameOrigin: vi.fn(),
}))

vi.mock("@/server/invoices/invoice.repository", () => ({
  deleteInvoice: vi.fn(),
  getInvoiceById: vi.fn(),
}))

vi.mock("@/server/invoices/invoice.service", () => ({
  updateInvoice: vi.fn(),
}))

const currentAdmin = { id: "admin-1", email: "admin@example.com", name: "Admin", role: "ADMIN" as const }
const validPayload = {
  customerName: "Nguyễn Văn A",
  phone: "0901234567",
  address: "Hà Nội",
  items: [{ productId: "product-1", quantity: 2 }],
  paymentMethod: "BANK_TRANSFER" as const,
  shippingMethod: "FREE" as const,
  shippingFee: 50_000,
  issueInvoice: false,
}

describe("/api/invoices/:id admin mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdmin).mockResolvedValue(currentAdmin)
    vi.mocked(updateInvoice).mockResolvedValue({ id: "invoice-1" } as never)
    vi.mocked(deleteInvoice).mockResolvedValue(undefined)
  })

  it("updates a complete invoice through the admin-only endpoint", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost:3000/api/invoices/invoice-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validPayload),
      }),
      { params: Promise.resolve({ id: "invoice-1" }) },
    )

    expect(response.status).toBe(200)
    expect(requireAdmin).toHaveBeenCalledOnce()
    expect(updateInvoice).toHaveBeenCalledWith("invoice-1", {
      ...validPayload,
      shippingFee: 0,
      discountType: "PERCENTAGE",
      discountValue: 0,
      invoiceInfo: undefined,
    })
  })

  it("permanently deletes an invoice through the admin-only endpoint", async () => {
    const response = await DELETE(
      new NextRequest("http://localhost:3000/api/invoices/invoice-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "invoice-1" }) },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, data: { deletedId: "invoice-1" } })
    expect(requireAdmin).toHaveBeenCalledOnce()
    expect(deleteInvoice).toHaveBeenCalledWith("invoice-1")
  })
})

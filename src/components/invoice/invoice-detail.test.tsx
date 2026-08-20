import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { InvoiceDetail } from "@/components/invoice/invoice-detail"

const replaceMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}))

function response(payload: unknown, ok = true): Response {
  return { ok, json: async () => payload } as Response
}

const invoice = {
  id: "invoice-1",
  invoiceNumber: "HD-20082026-0001",
  customerName: "Nguyễn Văn A",
  phone: "0901234567",
  address: "Hà Nội",
  warehouse: null,
  paymentMethod: "BANK_TRANSFER",
  shippingMethod: "FREE",
  shippingFee: 0,
  subtotal: 242000,
  discountType: "PERCENTAGE",
  discountValue: 0,
  discountAmount: 0,
  total: 242000,
  note: null,
  issueInvoice: false,
  companyName: null,
  invoiceAddress: null,
  invoiceEmail: null,
  status: "CONFIRMED",
  createdAt: "2026-08-20T00:00:00.000Z",
  items: [{ productId: "product-1", productName: "Rượu táo mèo", volume: "700 ml", concentration: "25", unitPrice: 242000, quantity: 1, lineTotal: 242000 }],
}

describe("InvoiceDetail admin actions", () => {
  const fetchMock = vi.fn()
  const confirmMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("confirm", confirmMock)
    confirmMock.mockReturnValue(true)
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (url === "/api/auth/me") return Promise.resolve(response({ success: true, data: { user: { role: "ADMIN" } } }))
      if (options?.method === "POST") return Promise.resolve(response({ success: true, data: { deletedId: "invoice-1" } }))
      return Promise.resolve(response({ success: true, data: { invoice } }))
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("shows edit/delete controls to admin and deletes after confirmation", async () => {
    render(<InvoiceDetail id="invoice-1" />)

    expect(await screen.findByRole("link", { name: "Sửa hóa đơn" })).toHaveAttribute("href", "/admin/invoices/invoice-1/edit")
    fireEvent.click(screen.getByRole("button", { name: "Xóa hóa đơn" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/invoices/invoice-1", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }))
    expect(confirmMock).toHaveBeenCalledWith("Xóa vĩnh viễn hóa đơn HD-20082026-0001? Thao tác này không thể hoàn tác.")
    expect(replaceMock).toHaveBeenCalledWith("/invoices")
  })
})

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { InvoiceForm } from "@/components/invoice/invoice-form"

function response(payload: unknown, ok = true): Response {
  return { ok, json: async () => payload } as Response
}

function chooseOpenOption(optionName: string): void {
  const option = screen.getByRole("option", { name: optionName })
  fireEvent.pointerDown(option, { pointerType: "mouse" })
  fireEvent.mouseUp(option)
  fireEvent.click(option)
}

function chooseOption(trigger: HTMLElement, optionName: string): void {
  fireEvent.click(trigger)
  chooseOpenOption(optionName)
}

const products = [
  { id: "tao-700", externalId: "Tao700", name: "Rượu táo mèo", volume: "700 ml", concentration: "25", price: 242000, isActive: true },
  { id: "tao-3l-19", externalId: "z", name: "Rượu táo mèo", volume: "3 lít", concentration: "19", price: 341000, isActive: true },
  { id: "tao-3l-25", externalId: "Tao3l_25", name: "Rượu táo mèo", volume: "3 lít", concentration: "25", price: 409000, isActive: true },
  { id: "tao-18l-19", externalId: "Tao18l_19", name: "Rượu táo mèo", volume: "18 lít", concentration: "19", price: 1870000, isActive: true },
  { id: "tao-18l-25", externalId: "Tao18l_25", name: "Rượu táo mèo", volume: "18 lít", concentration: "25", price: 2200000, isActive: true },
]

describe("InvoiceForm product selectors", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockResolvedValue(response({
      success: true,
      data: { products },
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("shows every Táo mèo volume and concentration from the synced catalog", async () => {
    render(<InvoiceForm />)

    const productRow = await waitFor(() => {
      const row = document.querySelector(".product-row")
      if (!(row instanceof HTMLElement)) throw new Error("Product row is not rendered yet")
      return row
    })

    chooseOption(within(productRow).getByRole("combobox", { name: "Tên sản phẩm" }), "Rượu táo mèo")

    fireEvent.click(within(productRow).getByRole("combobox", { name: "Thể tích" }))
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["700 ml", "3 lít", "18 lít"])
    chooseOpenOption("3 lít")

    fireEvent.click(within(productRow).getByRole("combobox", { name: "Nồng độ" }))
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["19", "25"])
    chooseOpenOption("25")

    expect(screen.getByTestId("invoice-preview")).toContainHTML("409.000đ")
  })

  it("allows selecting a product that has no concentration", async () => {
    fetchMock.mockResolvedValueOnce(response({
      success: true,
      data: {
        products: [{
          id: "bong-415",
          externalId: "Bong_415",
          name: "Bỗng nấu ăn 9Chum",
          volume: "415 ml",
          concentration: "",
          price: 31000,
          isActive: true,
        }],
      },
    }))

    render(<InvoiceForm />)

    const productRow = await waitFor(() => {
      const row = document.querySelector(".product-row")
      if (!(row instanceof HTMLElement)) throw new Error("Product row is not rendered yet")
      return row
    })

    chooseOption(within(productRow).getByRole("combobox", { name: "Tên sản phẩm" }), "Bỗng nấu ăn 9Chum")
    chooseOption(within(productRow).getByRole("combobox", { name: "Thể tích" }), "415 ml")
    chooseOption(within(productRow).getByRole("combobox", { name: "Nồng độ" }), "Không áp dụng")

    expect(screen.getByTestId("invoice-preview")).toContainHTML("31.000đ")
  })

  it("renders larger, easier-to-tap product selectors and menu options", async () => {
    render(<InvoiceForm />)

    const productRow = await waitFor(() => {
      const row = document.querySelector(".product-row")
      if (!(row instanceof HTMLElement)) throw new Error("Product row is not rendered yet")
      return row
    })

    for (const label of ["Tên sản phẩm", "Thể tích", "Nồng độ"]) {
      expect(within(productRow).getByRole("combobox", { name: label })).toHaveClass("h-11", "text-sm")
    }

    fireEvent.click(within(productRow).getByRole("combobox", { name: "Tên sản phẩm" }))
    expect(screen.getAllByRole("option")[0]).toHaveClass("min-h-10", "text-sm")
  })

  it("loads an existing invoice and saves it through PATCH", async () => {
    const invoice = {
      id: "invoice-1",
      invoiceNumber: "HD-20082026-0001",
      customerName: "Khách cũ",
      phone: "0901234567",
      address: "Hà Nội",
      warehouse: "L7-21",
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
      items: [{ productId: "tao-700", productName: "Rượu táo mèo", volume: "700 ml", concentration: "25", unitPrice: 242000, quantity: 1, lineTotal: 242000 }],
    }
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (url === "/api/invoices/invoice-1" && options?.method === "PATCH") {
        return Promise.resolve(response({ success: true, data: { invoice: { ...invoice, customerName: "Khách mới" } } }))
      }
      if (url === "/api/invoices/invoice-1") return Promise.resolve(response({ success: true, data: { invoice } }))
      return Promise.resolve(response({ success: true, data: { products } }))
    })

    render(<InvoiceForm invoiceId="invoice-1" />)

    expect(await screen.findByRole("heading", { name: "Sửa hóa đơn" })).toBeInTheDocument()
    expect(screen.getByLabelText("Tên khách hàng")).toHaveValue("Khách cũ")
    fireEvent.change(screen.getByLabelText("Tên khách hàng"), { target: { value: "Khách mới" } })
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }))

    await waitFor(() => {
      const updateCall = fetchMock.mock.calls.find(([url, options]) => url === "/api/invoices/invoice-1" && options?.method === "PATCH")
      expect(updateCall).toBeDefined()
      expect(JSON.parse(updateCall?.[1]?.body as string)).toMatchObject({ customerName: "Khách mới", items: [{ productId: "tao-700", quantity: 1 }] })
    })
  })
})

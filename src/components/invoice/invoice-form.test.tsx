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
})

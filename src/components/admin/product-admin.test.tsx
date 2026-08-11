import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { ProductAdmin } from "@/components/admin/product-admin"

function response(payload: unknown, ok = true): Response {
  return { ok, json: async () => payload } as Response
}

const productsResponse = {
  success: true,
  data: {
    products: [{
      id: "product-1",
      externalId: "SP001",
      name: "Sản phẩm A",
      volume: "30ml",
      concentration: "10%",
      price: 150000,
      isActive: true,
    }],
    pagination: { total: 1 },
  },
}

const sheetConfigResponse = {
  success: true,
  data: {
    configured: true,
    spreadsheetUrl: "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit",
    sheetName: "Products",
    source: "database",
    credentialsConfigured: true,
    updatedAt: null,
  },
}

describe("ProductAdmin", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith("/api/admin/products?")) return Promise.resolve(response(productsResponse))
      return Promise.resolve(response(sheetConfigResponse))
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("keeps Google Sheet sync disabled until the server credential is ready", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith("/api/admin/products?")) return Promise.resolve(response(productsResponse))
      return Promise.resolve(response({
        ...sheetConfigResponse,
        data: { ...sheetConfigResponse.data, credentialsConfigured: false },
      }))
    })

    render(<ProductAdmin />)

    await screen.findByText("Sản phẩm A")
    await waitFor(() => expect(screen.getByRole("button", { name: "Đồng bộ Google Sheets" })).toBeDisabled())
  })

  it("enables Google Sheet sync after both source and credential are configured", async () => {
    render(<ProductAdmin />)

    await screen.findByText("Sản phẩm A")
    await waitFor(() => expect(screen.getByRole("button", { name: "Đồng bộ Google Sheets" })).toBeEnabled())
  })
})

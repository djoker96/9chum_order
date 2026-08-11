import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { GoogleSheetConfig } from "@/components/admin/google-sheet-config"

function response(payload: unknown, ok = true): Response {
  return {
    ok,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => payload,
  } as unknown as Response
}

function htmlResponse(status = 500): Response {
  return {
    ok: false,
    status,
    headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
    json: async () => { throw new SyntaxError("Unexpected token '<'") },
  } as unknown as Response
}

const spreadsheetId = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"
const configResponse = {
  success: true,
  data: {
    configured: true,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    sheetName: "Products",
    source: "database",
    credentialsConfigured: true,
    updatedAt: "2026-08-10T00:00:00.000Z",
  },
}

describe("GoogleSheetConfig", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockResolvedValue(response(configResponse))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("loads the current source and saves an edited tab", async () => {
    fetchMock
      .mockResolvedValueOnce(response(configResponse))
      .mockResolvedValueOnce(response({ ...configResponse, data: { ...configResponse.data, sheetName: "Catalog" } }))

    render(<GoogleSheetConfig />)
    expect(await screen.findByDisplayValue("Products")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Tên tab"), { target: { value: "Catalog" } })
    fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/products/google-sheet-config",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ spreadsheetUrl: configResponse.data.spreadsheetUrl, sheetName: "Catalog" }) }),
    ))
    expect(await screen.findByText("Đã lưu cấu hình Google Sheets. Bạn có thể đồng bộ danh mục ngay.")).toBeInTheDocument()
  })

  it("shows a deployment error instead of exposing a JSON parser error when the API returns HTML", async () => {
    fetchMock
      .mockResolvedValueOnce(response(configResponse))
      .mockResolvedValueOnce(htmlResponse(404))

    render(<GoogleSheetConfig />)
    await screen.findByDisplayValue("Products")

    fireEvent.change(screen.getByLabelText("Tên tab"), { target: { value: "Catalog" } })
    fireEvent.click(screen.getByRole("button", { name: "Lưu cấu hình" }))

    expect(await screen.findByText("API cấu hình Google Sheets chưa được triển khai trên server. Hãy deploy lại backend.")).toBeInTheDocument()
    expect(screen.queryByText("Unexpected token '<'", { exact: false })).not.toBeInTheDocument()
  })

  it("shows the required columns and a downloadable CSV template", async () => {
    render(<GoogleSheetConfig />)

    await screen.findByDisplayValue("Products")

    expect(screen.getByText("Cột bắt buộc trong tab sản phẩm")).toBeInTheDocument()
    expect(screen.getByText("product_name")).toBeInTheDocument()
    expect(screen.getByText(/Giá \(VNĐ\)/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Tải mẫu CSV" })).toHaveAttribute(
      "href",
      "/templates/products-import.csv",
    )
  })

  it("reports that syncing is not ready when server credentials are missing", async () => {
    const onConfiguredChange = vi.fn()
    fetchMock.mockResolvedValueOnce(response({
      ...configResponse,
      data: { ...configResponse.data, credentialsConfigured: false },
    }))

    render(<GoogleSheetConfig onConfiguredChange={onConfiguredChange} />)

    await screen.findByText("chưa cấu hình")
    await waitFor(() => expect(onConfiguredChange).toHaveBeenLastCalledWith(false))
  })
})

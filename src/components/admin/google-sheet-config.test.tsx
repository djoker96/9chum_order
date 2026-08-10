import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { GoogleSheetConfig } from "@/components/admin/google-sheet-config"

function response(payload: unknown, ok = true): Response {
  return { ok, json: async () => payload } as Response
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
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ spreadsheetUrl: configResponse.data.spreadsheetUrl, sheetName: "Catalog" }) }),
    ))
    expect(await screen.findByText("Đã lưu cấu hình Google Sheets. Bạn có thể đồng bộ danh mục ngay.")).toBeInTheDocument()
  })
})

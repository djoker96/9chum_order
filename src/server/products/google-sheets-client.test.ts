import { beforeEach, describe, expect, it, vi } from "vitest"
import { AppError } from "@/server/http/api"
import { readGoogleSheetProductRows } from "@/server/products/google-sheets"

const mocks = vi.hoisted(() => ({
  getServerEnv: vi.fn(),
  GoogleAuth: vi.fn(),
  sheets: vi.fn(),
  valuesGet: vi.fn(),
}))

vi.mock("@/lib/env", () => ({ getServerEnv: mocks.getServerEnv }))
vi.mock("googleapis", () => ({
  google: {
    auth: { GoogleAuth: mocks.GoogleAuth },
    sheets: mocks.sheets,
  },
}))

const config = { spreadsheetId: "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789", sheetName: "Kho chính" }
const validValues = [
  ["id", "product_name", "concentration", "volume", "price", "active"],
  ["SP001", "Sản phẩm A", "10%", "30ml", "150000", "TRUE"],
]

describe("Google Sheets client", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getServerEnv.mockReturnValue({
      GOOGLE_PROJECT_ID: "project-1",
      GOOGLE_CLIENT_EMAIL: "service-account@example.iam.gserviceaccount.com",
      GOOGLE_PRIVATE_KEY: "private-key",
    })
    mocks.GoogleAuth.mockReturnValue({ auth: "service-account-auth" })
    mocks.sheets.mockReturnValue({ spreadsheets: { values: { get: mocks.valuesGet } } })
    mocks.valuesGet.mockResolvedValue({ data: { values: validValues } })
  })

  it("reads the configured tab through the read-only Sheets API", async () => {
    await expect(readGoogleSheetProductRows(config)).resolves.toEqual([{
      id: "SP001",
      product_name: "Sản phẩm A",
      concentration: "10%",
      volume: "30ml",
      price: "150000",
      active: "TRUE",
    }])

    expect(mocks.valuesGet).toHaveBeenCalledWith({
      spreadsheetId: config.spreadsheetId,
      range: "'Kho chính'!A:F",
    })
    expect(mocks.GoogleAuth).toHaveBeenCalledWith(expect.objectContaining({
      credentials: expect.objectContaining({ client_email: "service-account@example.iam.gserviceaccount.com" }),
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    }))
  })

  it("maps permission failures to a safe configuration error", async () => {
    mocks.valuesGet.mockRejectedValue({ response: { status: 403 } })

    await expect(readGoogleSheetProductRows(config)).rejects.toMatchObject({
      status: 503,
      code: "GOOGLE_SHEET_ACCESS_DENIED",
    } satisfies Partial<AppError>)
  })

  it("fails before calling Google when server credentials are incomplete", async () => {
    mocks.getServerEnv.mockReturnValue({ GOOGLE_PROJECT_ID: "project-1" })

    await expect(readGoogleSheetProductRows(config)).rejects.toMatchObject({
      status: 503,
      code: "GOOGLE_SHEET_ACCESS_DENIED",
    } satisfies Partial<AppError>)
    expect(mocks.valuesGet).not.toHaveBeenCalled()
  })
})

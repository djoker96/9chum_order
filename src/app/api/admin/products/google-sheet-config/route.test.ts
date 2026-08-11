import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { AppError } from "@/server/http/api"
import { GET, POST, PUT } from "@/app/api/admin/products/google-sheet-config/route"
import { requireAdmin } from "@/server/auth/session"
import {
  getGoogleSheetConfigView,
  saveGoogleSheetConfig,
} from "@/server/products/google-sheet-config.service"

vi.mock("@/server/auth/session", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/server/products/google-sheet-config.service", () => ({
  getGoogleSheetConfigView: vi.fn(),
  saveGoogleSheetConfig: vi.fn(),
}))

const currentAdmin = { id: "admin-1", email: "admin@example.com", name: "Admin", role: "ADMIN" as const }
const spreadsheetId = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"

describe("/api/admin/products/google-sheet-config", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdmin).mockResolvedValue(currentAdmin)
    vi.mocked(getGoogleSheetConfigView).mockResolvedValue({
      configured: true,
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      sheetName: "Products",
      source: "database",
      credentialsConfigured: true,
      updatedAt: "2026-08-10T00:00:00.000Z",
    })
    vi.mocked(saveGoogleSheetConfig).mockResolvedValue({
      configured: true,
      spreadsheetId,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      sheetName: "Products",
      source: "database",
      credentialsConfigured: true,
      updatedAt: "2026-08-10T00:00:00.000Z",
    })
  })

  it("returns configuration metadata to an admin without returning credentials", async () => {
    const response = await GET(new NextRequest("http://localhost:3000/api/admin/products/google-sheet-config"))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data).toMatchObject({ spreadsheetId, sheetName: "Products", credentialsConfigured: true })
    expect(JSON.stringify(payload)).not.toContain("private_key")
    expect(JSON.stringify(payload)).not.toContain("client_email")
  })

  it("validates and saves the spreadsheet URL and tab name", async () => {
    const response = await PUT(new NextRequest("http://localhost:3000/api/admin/products/google-sheet-config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        sheetName: " Products ",
      }),
    }))

    expect(response.status).toBe(200)
    expect(saveGoogleSheetConfig).toHaveBeenCalledWith({ spreadsheetId, sheetName: "Products" }, currentAdmin.id)
  })

  it("accepts POST for production proxies that block PUT", async () => {
    const response = await POST(new NextRequest("http://localhost:3000/api/admin/products/google-sheet-config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        sheetName: "Products",
      }),
    }))

    expect(response.status).toBe(200)
    expect(saveGoogleSheetConfig).toHaveBeenCalledWith({ spreadsheetId, sheetName: "Products" }, currentAdmin.id)
  })

  it("rejects invalid configuration before writing it", async () => {
    const response = await PUT(new NextRequest("http://localhost:3000/api/admin/products/google-sheet-config", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ spreadsheetUrl: "https://example.com/file", sheetName: "Products" }),
    }))

    expect(response.status).toBe(400)
    expect(saveGoogleSheetConfig).not.toHaveBeenCalled()
  })

  it("preserves explicit authorization failures", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new AppError(403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này."))

    const response = await GET(new NextRequest("http://localhost:3000/api/admin/products/google-sheet-config"))

    expect(response.status).toBe(403)
    expect(getGoogleSheetConfigView).not.toHaveBeenCalled()
  })
})

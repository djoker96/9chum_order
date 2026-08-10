import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { AppError } from "@/server/http/api"
import { POST } from "@/app/api/admin/products/sync/route"
import { requireAdmin } from "@/server/auth/session"
import { syncProductsFromGoogleSheets } from "@/server/products/sync.service"

vi.mock("@/server/auth/session", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/server/products/sync.service", () => ({
  syncProductsFromGoogleSheets: vi.fn(),
}))

const currentAdmin = { id: "admin-1", email: "admin@example.com", name: "Admin", role: "ADMIN" as const }

describe("POST /api/admin/products/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdmin).mockResolvedValue(currentAdmin)
    vi.mocked(syncProductsFromGoogleSheets).mockResolvedValue({
      syncLogId: "sync-1",
      created: 1,
      updated: 2,
      unchanged: 3,
      skipped: 0,
      errors: 0,
      completedAt: new Date("2026-08-10T00:00:00.000Z"),
      details: [],
    })
  })

  it("allows an admin to trigger the configured Google Sheet sync", async () => {
    const response = await POST(new NextRequest("http://localhost:3000/api/admin/products/sync", { method: "POST" }))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data).toMatchObject({ syncLogId: "sync-1", created: 1, updated: 2, unchanged: 3 })
    expect(syncProductsFromGoogleSheets).toHaveBeenCalledWith(currentAdmin.id)
  })

  it("does not start a sync for a non-admin caller", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new AppError(403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này."))

    const response = await POST(new NextRequest("http://localhost:3000/api/admin/products/sync", { method: "POST" }))

    expect(response.status).toBe(403)
    expect(syncProductsFromGoogleSheets).not.toHaveBeenCalled()
  })
})

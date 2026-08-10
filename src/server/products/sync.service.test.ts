import { beforeEach, describe, expect, it, vi } from "vitest"
import { AppError } from "@/server/http/api"
import { syncProductsFromGoogleSheets, syncProductsFromRows } from "@/server/products/sync.service"

const mocks = vi.hoisted(() => ({
  createLog: vi.fn(),
  updateLog: vi.fn(),
  getConfig: vi.fn(),
  readRows: vi.fn(),
  normalizeRows: vi.fn(),
  syncRows: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    productSyncLog: { create: mocks.createLog, update: mocks.updateLog },
  },
}))
vi.mock("@/server/products/product.repository", () => ({ productRepository: {} }))
vi.mock("@/server/products/google-sheet-config.service", () => ({ getGoogleSheetSourceConfig: mocks.getConfig }))
vi.mock("@/server/products/google-sheets", () => ({ readGoogleSheetProductRows: mocks.readRows }))
vi.mock("@/server/products/product-sync", () => ({
  normalizeProductRows: mocks.normalizeRows,
  syncProductRows: mocks.syncRows,
}))

describe("product sync service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createLog.mockResolvedValue({ id: "sync-1" })
    mocks.updateLog.mockResolvedValue({ id: "sync-1" })
    mocks.getConfig.mockResolvedValue({ spreadsheetId: "sheet-1", sheetName: "Products" })
    mocks.readRows.mockResolvedValue([{ id: "SP001" }])
    mocks.normalizeRows.mockReturnValue({ rows: [{ externalId: "SP001" }], errors: [] })
    mocks.syncRows.mockResolvedValue({ created: 1, updated: 0, unchanged: 0, skipped: 0, errors: 0, details: [] })
  })

  it("loads the saved source, syncs rows, and closes the log successfully", async () => {
    const result = await syncProductsFromGoogleSheets("admin-1")

    expect(mocks.getConfig).toHaveBeenCalledOnce()
    expect(mocks.readRows).toHaveBeenCalledWith({ spreadsheetId: "sheet-1", sheetName: "Products" })
    expect(result).toMatchObject({ syncLogId: "sync-1", created: 1, errors: 0 })
    expect(mocks.updateLog).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "sync-1" },
      data: expect.objectContaining({ status: "SUCCESS", createdCount: 1, errorCount: 0 }),
    }))
  })

  it("records a failed log when the configured source cannot be read", async () => {
    mocks.readRows.mockRejectedValue(new AppError(503, "GOOGLE_SHEET_ACCESS_DENIED", "Không thể truy cập Google Sheet."))

    await expect(syncProductsFromGoogleSheets("admin-1")).rejects.toMatchObject({ code: "GOOGLE_SHEET_ACCESS_DENIED" })
    expect(mocks.updateLog).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "sync-1" },
      data: expect.objectContaining({ status: "FAILED", errorCount: 1 }),
    }))
  })

  it("marks a row sync partial when validation returns row errors", async () => {
    mocks.normalizeRows.mockReturnValue({
      rows: [{ externalId: "SP001" }],
      errors: [{ row: 3, code: "INVALID_ROW", message: "Dữ liệu không hợp lệ." }],
    })

    const result = await syncProductsFromRows([{ id: "SP001" }], "admin-1", "EXCEL")

    expect(result).toMatchObject({ skipped: 1, errors: 1 })
    expect(mocks.updateLog).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PARTIAL", skippedCount: 1, errorCount: 1 }),
    }))
  })
})

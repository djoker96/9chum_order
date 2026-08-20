import { describe, expect, it, vi } from "vitest"
import { getStatistics, type StatisticsRepository } from "@/server/statistics/statistics.service"

const staffUser = { id: "staff-1", email: "staff@example.com", name: "Staff One", role: "STAFF" as const }
const adminUser = { id: "admin-1", email: "admin@example.com", name: "Admin", role: "ADMIN" as const }
const staffAccounts = [
  { id: "staff-1", email: "staff@example.com", name: "Staff One", isActive: true },
  { id: "staff-2", email: "old@example.com", name: "Former Staff", isActive: false },
]

function makeRepository(overrides: Partial<StatisticsRepository> = {}): StatisticsRepository {
  return {
    listStaff: vi.fn(async () => staffAccounts),
    listConfirmedInvoices: vi.fn(async () => []),
    listInvoices: vi.fn(async () => ({ invoices: [], total: 0 })),
    ...overrides,
  }
}

const query = { period: "month" as const, date: "2026-08-01", page: 1, pageSize: 20 }

describe("statistics service", () => {
  it("always limits staff to invoices they created", async () => {
    const repository = makeRepository()

    const result = await getStatistics({ ...query, staffId: "staff-2" }, staffUser, repository)

    expect(repository.listStaff).not.toHaveBeenCalled()
    expect(repository.listConfirmedInvoices).toHaveBeenCalledWith(expect.any(Object), { staffId: "staff-1" })
    expect(repository.listInvoices).toHaveBeenCalledWith(expect.any(Object), { staffId: "staff-1" }, { page: 1, pageSize: 20, search: undefined })
    expect(result.selectedStaffId).toBe("staff-1")
  })

  it("limits the admin all view to staff and summarizes every staff account", async () => {
    const repository = makeRepository({
      listConfirmedInvoices: vi.fn(async () => [{
        status: "CONFIRMED" as const,
        total: 105,
        createdAt: new Date("2026-08-04T03:00:00.000Z"),
        createdById: "staff-2",
      }]),
    })

    const result = await getStatistics(query, adminUser, repository)

    expect(repository.listConfirmedInvoices).toHaveBeenCalledWith(expect.any(Object), { allStaff: true })
    expect(repository.listInvoices).toHaveBeenCalledWith(expect.any(Object), { allStaff: true }, expect.any(Object))
    expect(result.summary).toEqual({ revenue: 105, commission: 11, invoiceCount: 1 })
    expect(result.staffSummary).toEqual([
      { id: "staff-1", email: "staff@example.com", name: "Staff One", isActive: true, revenue: 0, commission: 0, invoiceCount: 0 },
      { id: "staff-2", email: "old@example.com", name: "Former Staff", isActive: false, revenue: 105, commission: 11, invoiceCount: 1 },
    ])
  })

  it("allows an admin to select an inactive staff account", async () => {
    const repository = makeRepository()

    const result = await getStatistics({ ...query, staffId: "staff-2" }, adminUser, repository)

    expect(repository.listConfirmedInvoices).toHaveBeenCalledWith(expect.any(Object), { staffId: "staff-2" })
    expect(result.selectedStaffId).toBe("staff-2")
    expect(result.staffSummary).toEqual([])
  })

  it("rejects an invalid staff id before querying invoices", async () => {
    const repository = makeRepository()

    await expect(getStatistics({ ...query, staffId: "missing" }, adminUser, repository)).rejects.toMatchObject({
      status: 400,
      code: "INVALID_STAFF",
    })
    expect(repository.listConfirmedInvoices).not.toHaveBeenCalled()
    expect(repository.listInvoices).not.toHaveBeenCalled()
  })

  it("returns cancelled invoices in the list without counting them", async () => {
    const repository = makeRepository({
      listConfirmedInvoices: vi.fn(async () => []),
      listInvoices: vi.fn(async () => ({
        invoices: [{
          id: "invoice-1",
          invoiceNumber: "HD-1",
          customerName: "Khách hàng",
          phone: "0900000000",
          total: 1_000,
          status: "CANCELLED" as const,
          createdAt: new Date("2026-08-04T03:00:00.000Z"),
          createdBy: { id: "staff-1", name: "Staff One", email: "staff@example.com" },
        }],
        total: 1,
      })),
    })

    const result = await getStatistics(query, adminUser, repository)

    expect(result.summary).toEqual({ revenue: 0, commission: 0, invoiceCount: 0 })
    expect(result.invoices).toHaveLength(1)
    expect(result.invoices[0]?.status).toBe("CANCELLED")
  })
})

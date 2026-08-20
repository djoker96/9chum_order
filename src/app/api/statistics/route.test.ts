import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "@/app/api/statistics/route"
import { requireUser } from "@/server/auth/session"
import { AppError } from "@/server/http/api"
import { getStatistics } from "@/server/statistics/statistics.service"

vi.mock("@/server/auth/session", () => ({ requireUser: vi.fn() }))
vi.mock("@/server/http/security", () => ({ assertApiRateLimit: vi.fn() }))
vi.mock("@/server/statistics/statistics.service", () => ({ getStatistics: vi.fn() }))

const currentUser = { id: "staff-1", email: "staff@example.com", name: "Staff", role: "STAFF" as const }

describe("GET /api/statistics", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireUser).mockResolvedValue(currentUser)
    vi.mocked(getStatistics).mockResolvedValue({ summary: { revenue: 0, commission: 0, invoiceCount: 0 } } as never)
  })

  it("passes validated filters and the current user to the service", async () => {
    const response = await GET(new NextRequest("http://localhost:3000/api/statistics?period=quarter&date=2026-05-01&staffId=staff-2&search=HD-1&page=2&pageSize=10"))

    expect(response.status).toBe(200)
    expect(getStatistics).toHaveBeenCalledWith({
      period: "quarter",
      date: "2026-05-01",
      staffId: "staff-2",
      search: "HD-1",
      page: 2,
      pageSize: 10,
    }, currentUser)
  })

  it.each([
    "period=decade&date=2026-05-01",
    "period=month&date=2026-02-30",
    "period=month&date=05-2026",
    "period=month&date=2026-05-01&pageSize=101",
  ])("rejects invalid query parameters: %s", async (query) => {
    const response = await GET(new NextRequest(`http://localhost:3000/api/statistics?${query}`))

    expect(response.status).toBe(400)
    expect(getStatistics).not.toHaveBeenCalled()
  })

  it("preserves authentication errors", async () => {
    vi.mocked(requireUser).mockRejectedValue(new AppError(401, "UNAUTHORIZED", "Vui lòng đăng nhập."))

    const response = await GET(new NextRequest("http://localhost:3000/api/statistics?period=month&date=2026-05-01"))

    expect(response.status).toBe(401)
    expect(getStatistics).not.toHaveBeenCalled()
  })
})

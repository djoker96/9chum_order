import { beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/prisma"
import { GET } from "@/app/api/health/route"
import { resetHealthCheckStateForTests } from "@/app/api/health/readiness"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetHealthCheckStateForTests()
  })

  it("coalesces concurrent probes and reuses readiness briefly", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-10T00:00:00Z"))
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ ready: 1 }])

    const [first, second] = await Promise.all([GET(), GET()])
    const cached = await GET()

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(cached.status).toBe(200)
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1_001)
    expect((await GET()).status).toBe(200)
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it("returns ready only after PostgreSQL responds", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ ready: 1 }])

    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { status: "ready" },
    })
  })

  it("returns a generic 503 response without leaking database details", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(
      new Error("password=super-secret host=db.internal version=16.4"),
    )

    const response = await GET()
    const body = await response.json()
    const serializedBody = JSON.stringify(body)

    expect(response.status).toBe(503)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(body).toEqual({
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Dịch vụ chưa sẵn sàng.",
      },
    })
    expect(serializedBody).not.toContain("super-secret")
    expect(serializedBody).not.toContain("db.internal")
    expect(serializedBody).not.toContain("16.4")
  })
})

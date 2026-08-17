import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "@/app/api/products/route"
import { requireUser } from "@/server/auth/session"
import { listActiveProducts } from "@/server/products/product.repository"

vi.mock("@/server/auth/session", () => ({ requireUser: vi.fn() }))
vi.mock("@/server/products/product.repository", () => ({ listActiveProducts: vi.fn() }))

describe("GET /api/products", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireUser).mockResolvedValue({ id: "staff-1", email: "staff@example.com", name: "Staff", role: "STAFF" })
    vi.mocked(listActiveProducts).mockResolvedValue({
      products: Array.from({ length: 65 }, (_, index) => ({
        id: `product-${index}`,
        externalId: `SP${index}`,
        name: "Rượu táo mèo",
        volume: `${index} lít`,
        concentration: "19",
        price: 100000,
        isActive: true,
        sourceOrder: index + 1,
        lastSyncedAt: null,
      })),
      pagination: { page: 1, pageSize: 65, total: 65, totalPages: 1 },
    })
  })

  it("returns the complete active catalog and keeps authentication in place", async () => {
    const response = await GET(new NextRequest("http://localhost:3000/api/products"))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.products).toHaveLength(65)
    expect(listActiveProducts).toHaveBeenCalledWith({ search: undefined })
    expect(requireUser).toHaveBeenCalledOnce()
  })

  it("passes a bounded search value to the repository", async () => {
    await GET(new NextRequest("http://localhost:3000/api/products?search=R%C6%B0%E1%BB%A3u%20t%C3%A1o%20m%C3%A8o"))

    expect(listActiveProducts).toHaveBeenCalledWith({ search: "Rượu táo mèo" })
  })
})

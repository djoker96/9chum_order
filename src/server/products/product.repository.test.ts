import { beforeEach, describe, expect, it, vi } from "vitest"
import { productRepository, listActiveProducts } from "@/server/products/product.repository"

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: { product: { findMany: mocks.findMany, updateMany: mocks.updateMany } },
}))

function product(index: number) {
  return {
    id: `product-${index}`,
    externalId: `SP${index}`,
    name: "Rượu táo mèo",
    concentration: "19",
    volume: `${index} lít`,
    price: 100000 + index,
    isActive: true,
    sourceOrder: index,
    lastSyncedAt: null,
  }
}

describe("product repository", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns every active product without applying the paginated 50-row default", async () => {
    const products = Array.from({ length: 65 }, (_, index) => product(index + 1))
    mocks.findMany.mockResolvedValue(products)

    const result = await listActiveProducts()

    expect(result.products).toHaveLength(65)
    expect(result.pagination).toEqual({ page: 1, pageSize: 65, total: 65, totalPages: 1 })
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true },
      orderBy: expect.any(Array),
      select: expect.any(Object),
    }))
    expect(mocks.findMany.mock.calls[0][0]).not.toHaveProperty("take")
    expect(mocks.findMany.mock.calls[0][0]).not.toHaveProperty("skip")
  })

  it("deactivates only active products missing from a successful Sheet source", async () => {
    const syncedAt = new Date("2026-08-17T00:00:00.000Z")
    mocks.updateMany.mockResolvedValue({ count: 2 })

    await expect(productRepository.deactivateMissingExternalIds(["SP001", "SP002"], syncedAt)).resolves.toBe(2)

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { isActive: true, externalId: { notIn: ["SP001", "SP002"] } },
      data: { isActive: false, lastSyncedAt: syncedAt },
    })
  })
})

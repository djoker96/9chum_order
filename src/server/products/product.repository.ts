import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import type { ProductRepository, ProductRecord, ProductWriteInput } from "@/server/products/product-sync"

function toProductRecord(product: {
  id: string
  externalId: string
  name: string
  concentration: string
  volume: string
  price: unknown
  isActive: boolean
  lastSyncedAt: Date | null
}): ProductRecord {
  return {
    id: product.id,
    externalId: product.externalId,
    name: product.name,
    concentration: product.concentration,
    volume: product.volume,
    price: Number(product.price),
    isActive: product.isActive,
    lastSyncedAt: product.lastSyncedAt,
  }
}

const productSelect = {
  id: true,
  externalId: true,
  name: true,
  concentration: true,
  volume: true,
  price: true,
  isActive: true,
  lastSyncedAt: true,
} satisfies Prisma.ProductSelect

export const productRepository: ProductRepository = {
  async findByExternalIds(externalIds) {
    if (externalIds.length === 0) return []
    const products = await prisma.product.findMany({
      where: { externalId: { in: externalIds } },
      select: productSelect,
    })
    return products.map(toProductRecord)
  },

  async create(input: ProductWriteInput) {
    const product = await prisma.product.create({ data: input })
    return toProductRecord(product)
  },

  async update(id: string, input: ProductWriteInput) {
    const product = await prisma.product.update({ where: { id }, data: input })
    return toProductRecord(product)
  },
}

export interface ProductListFilters {
  search?: string
  status?: "ACTIVE" | "INACTIVE" | "ALL"
  page?: number
  pageSize?: number
}

export async function listProducts(filters: ProductListFilters = {}) {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const search = filters.search?.trim()
  const where = {
    ...(filters.status === "ACTIVE" ? { isActive: true } : {}),
    ...(filters.status === "INACTIVE" ? { isActive: false } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { externalId: { contains: search, mode: "insensitive" as const } },
            { volume: { contains: search, mode: "insensitive" as const } },
            { concentration: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ name: "asc" }, { volume: "asc" }, { concentration: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ])

  return {
    products: products.map(toProductRecord),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  }
}

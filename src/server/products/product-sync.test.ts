import { describe, expect, it } from "vitest"
import { normalizeProductRows, syncProductRows, type ProductRepository } from "@/server/products/product-sync"

const rows = [
  { id: "SP001", product_name: "Sản phẩm A", concentration: "10%", volume: "30ml", price: "150.000", active: "TRUE" },
  { id: "SP002", product_name: "Sản phẩm B", concentration: "20%", volume: "50ml", price: 250000, active: false },
]

describe("product sync", () => {
  it("normalizes valid sheet rows into product master data", () => {
    expect(normalizeProductRows(rows)).toEqual({
      rows: [
        { externalId: "SP001", name: "Sản phẩm A", concentration: "10%", volume: "30ml", price: 150000, isActive: true, sourceOrder: 1 },
        { externalId: "SP002", name: "Sản phẩm B", concentration: "20%", volume: "50ml", price: 250000, isActive: false, sourceOrder: 2 },
      ],
      errors: [],
    })
  })

  it("keeps products whose concentration is intentionally blank", () => {
    expect(normalizeProductRows([
      { id: "Bong_415", product_name: "Bỗng nấu ăn 9Chum", concentration: "", volume: "415 ml", price: "31,000", active: true },
      { id: "MQH_415", product_name: "Gia vị thảo mộc - Mộc Quế Hương", concentration: "", volume: "415 ml", price: "50,000", active: true },
    ])).toEqual({
      rows: [
        { externalId: "Bong_415", name: "Bỗng nấu ăn 9Chum", concentration: "", volume: "415 ml", price: 31000, isActive: true, sourceOrder: 1 },
        { externalId: "MQH_415", name: "Gia vị thảo mộc - Mộc Quế Hương", concentration: "", volume: "415 ml", price: 50000, isActive: true, sourceOrder: 2 },
      ],
      errors: [],
    })
  })

  it("reports invalid and duplicate rows without aborting the batch", () => {
    const result = normalizeProductRows([
      ...rows,
      { id: "SP001", product_name: "Duplicate", concentration: "10%", volume: "30ml", price: 1, active: true },
      { id: "", product_name: "Missing ID", concentration: "10%", volume: "30ml", price: 1, active: true },
    ])

    expect(result.rows).toHaveLength(2)
    expect(result.errors).toHaveLength(2)
    expect(result.errors.map((error) => error.code)).toEqual(["DUPLICATE_ID", "INVALID_ROW"])
  })

  it("rejects negative or non-numeric prices instead of stripping them into valid values", () => {
    const result = normalizeProductRows([
      { id: "SP-NEGATIVE", product_name: "Negative", concentration: "10%", volume: "30ml", price: "-150000", active: true },
      { id: "SP-TEXT", product_name: "Text", concentration: "10%", volume: "30ml", price: "150000abc", active: true },
    ])

    expect(result.rows).toEqual([])
    expect(result.errors).toHaveLength(2)
  })

  it("creates, updates, and counts unchanged products", async () => {
    const stored = new Map<string, { id: string; externalId: string; name: string; concentration: string; volume: string; price: number; isActive: boolean; sourceOrder: number | null }>([
      ["SP001", { id: "product-1", externalId: "SP001", name: "Old name", concentration: "10%", volume: "30ml", price: 100000, isActive: true, sourceOrder: 1 }],
      ["SP003", { id: "product-3", externalId: "SP003", name: "Same", concentration: "30%", volume: "30ml", price: 300000, isActive: true, sourceOrder: 2 }],
    ])
    let bulkLookupCount = 0
    const repository: ProductRepository = {
      findByExternalIds: async (externalIds) => {
        bulkLookupCount += 1
        return externalIds.flatMap((externalId) => {
          const product = stored.get(externalId)
          return product ? [product] : []
        })
      },
      create: async (input) => {
        const product = { id: `new-${input.externalId}`, ...input }
        stored.set(input.externalId, product)
        return product
      },
      update: async (id, input) => {
        const current = [...stored.values()].find((product) => product.id === id)
        if (!current) throw new Error("not found")
        const product = { ...current, ...input }
        stored.set(product.externalId, product)
        return product
      },
      deactivateMissingExternalIds: async () => 0,
    }

    const summary = await syncProductRows(
      [
        { externalId: "SP001", name: "New name", concentration: "10%", volume: "30ml", price: 150000, isActive: true, sourceOrder: 1 },
        { externalId: "SP003", name: "Same", concentration: "30%", volume: "30ml", price: 300000, isActive: true, sourceOrder: 2 },
        { externalId: "SP004", name: "New", concentration: "40%", volume: "10ml", price: 400000, isActive: true, sourceOrder: 3 },
      ],
      repository,
    )

    expect(summary).toMatchObject({ created: 1, updated: 1, unchanged: 1, errors: 0, skipped: 0 })
    expect(bulkLookupCount).toBe(1)
    expect(stored.get("SP001")?.price).toBe(150000)
    expect(stored.has("SP004")).toBe(true)
  })

  it("records a row write failure without aborting other rows", async () => {
    const repository: ProductRepository = {
      findByExternalIds: async () => [],
      create: async (input) => {
        if (input.externalId === "SP005") throw new Error("database unavailable")
        return { id: "product-6", ...input }
      },
      update: async (id, input) => ({ id, ...input }),
      deactivateMissingExternalIds: async () => 0,
    }

    const summary = await syncProductRows([
      { externalId: "SP005", name: "Fails", concentration: "10%", volume: "30ml", price: 150000, isActive: true, sourceOrder: 1 },
      { externalId: "SP006", name: "Works", concentration: "10%", volume: "30ml", price: 150000, isActive: true, sourceOrder: 2 },
    ], repository)

    expect(summary).toMatchObject({ created: 1, errors: 1 })
    expect(summary.details).toEqual([{
      row: 2,
      code: "SYNC_ERROR",
      message: "Không thể lưu sản phẩm SP005.",
    }])
  })
})

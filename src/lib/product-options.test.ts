import { describe, expect, it } from "vitest"
import {
  findProductVariant,
  getProductConcentrations,
  getProductNames,
  getProductVolumes,
} from "@/lib/product-options"
import type { ProductVariant } from "@/types/domain"

const products: ProductVariant[] = [
  { id: "tao-700", externalId: "Tao700", name: "Rượu táo mèo", volume: "700 ml", concentration: "25", price: 242000, isActive: true },
  { id: "tao-3l-19", externalId: "z", name: "Rượu táo mèo", volume: "3 lít", concentration: "19", price: 341000, isActive: true },
  { id: "tao-3l-25", externalId: "Tao3l_25", name: " Rượu  táo mèo ", volume: "3 lít", concentration: "25", price: 409000, isActive: true },
  { id: "tao-18l-19", externalId: "Tao18l_19", name: "Rượu táo mèo", volume: "18 lít", concentration: "19", price: 1870000, isActive: true },
  { id: "tao-18l-25", externalId: "Tao18l_25", name: "Rượu táo mèo", volume: "18 lít", concentration: "25", price: 2200000, isActive: true },
  { id: "mo-3l", externalId: "Mo3l", name: "Rượu mơ rừng", volume: "3 lít", concentration: "19", price: 341000, isActive: true },
]

describe("product selector options", () => {
  it("deduplicates equivalent labels while preserving source order", () => {
    expect(getProductNames(products)).toEqual(["Rượu táo mèo", "Rượu mơ rừng"])
    expect(getProductVolumes(products, "Rượu táo mèo")).toEqual(["700 ml", "3 lít", "18 lít"])
    expect(getProductConcentrations(products, "Rượu táo mèo", "3 lít")).toEqual(["19", "25"])
  })

  it("resolves the selected combination to the exact product variant", () => {
    expect(findProductVariant(products, "Rượu táo mèo", "3 lít", "25")).toMatchObject({
      id: "tao-3l-25",
      externalId: "Tao3l_25",
      price: 409000,
    })
  })
})

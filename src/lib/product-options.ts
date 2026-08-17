import type { ProductVariant } from "@/types/domain"

export function normalizeProductOptionText(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ")
}

function sameProductOptionText(left: string, right: string): boolean {
  return normalizeProductOptionText(left) === normalizeProductOptionText(right)
}

function uniqueLabels(labels: string[]): string[] {
  const seen = new Set<string>()
  return labels.filter((label) => {
    const key = normalizeProductOptionText(label)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function getProductNames(products: ProductVariant[]): string[] {
  return uniqueLabels(products.map((product) => product.name))
}

export function getProductVolumes(products: ProductVariant[], name: string): string[] {
  return uniqueLabels(
    products
      .filter((product) => sameProductOptionText(product.name, name))
      .map((product) => product.volume),
  )
}

export function getProductConcentrations(products: ProductVariant[], name: string, volume: string): string[] {
  return uniqueLabels(
    products
      .filter((product) => sameProductOptionText(product.name, name) && sameProductOptionText(product.volume, volume))
      .map((product) => product.concentration),
  )
}

export function findProductVariant(
  products: ProductVariant[],
  name: string,
  volume: string,
  concentration: string,
): ProductVariant | undefined {
  return products.find((product) => (
    sameProductOptionText(product.name, name)
    && sameProductOptionText(product.volume, volume)
    && sameProductOptionText(product.concentration, concentration)
  ))
}

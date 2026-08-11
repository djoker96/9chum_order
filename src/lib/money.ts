export type ShippingMethod = "FREE" | "DELIVERY_APP" | "COURIER"
export type DiscountType = "PERCENTAGE" | "AMOUNT"

export interface InvoiceLineInput {
  unitPrice: number
  quantity: number
}

export interface InvoiceTotals {
  lineTotals: number[]
  subtotal: number
  discountType: DiscountType
  discountValue: number
  discountAmount: number
  shippingFee: number
  total: number
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`)
  }
}

function assertQuantity(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("Quantity must be a positive integer")
  }
}

export function calculateInvoiceTotals(
  lines: InvoiceLineInput[],
  requestedShippingFee: number,
  shippingMethod: ShippingMethod = "DELIVERY_APP",
  discountType: DiscountType = "PERCENTAGE",
  discountValue = 0,
): InvoiceTotals {
  assertNonNegativeInteger(requestedShippingFee, "Shipping fee")
  assertNonNegativeInteger(discountValue, "Discount value")

  if (discountType !== "PERCENTAGE" && discountType !== "AMOUNT") {
    throw new Error("Discount type is invalid")
  }
  if (discountType === "PERCENTAGE" && discountValue > 100) {
    throw new Error("Discount percentage must be between 0 and 100")
  }

  const lineTotals = lines.map(({ unitPrice, quantity }) => {
    assertNonNegativeInteger(unitPrice, "Unit price")
    assertQuantity(quantity)

    const lineTotal = unitPrice * quantity
    if (!Number.isSafeInteger(lineTotal)) {
      throw new Error("Line total exceeds the supported amount")
    }

    return lineTotal
  })

  const subtotal = lineTotals.reduce((sum, lineTotal) => sum + lineTotal, 0)
  if (!Number.isSafeInteger(subtotal)) {
    throw new Error("Subtotal exceeds the supported amount")
  }

  const discountAmount = discountType === "PERCENTAGE"
    ? (() => {
        const wholePercentage = Math.floor(subtotal / 100)
        const remainder = subtotal - wholePercentage * 100
        return wholePercentage * discountValue + Math.round((remainder * discountValue) / 100)
      })()
    : discountValue

  if (!Number.isSafeInteger(discountAmount)) {
    throw new Error("Discount amount exceeds the supported amount")
  }
  if (discountAmount > subtotal) {
    throw new Error("Discount amount must not exceed subtotal")
  }

  const shippingFee = shippingMethod === "FREE" ? 0 : requestedShippingFee
  const total = subtotal - discountAmount + shippingFee
  if (!Number.isSafeInteger(total)) {
    throw new Error("Total exceeds the supported amount")
  }

  return { lineTotals, subtotal, discountType, discountValue, discountAmount, shippingFee, total }
}

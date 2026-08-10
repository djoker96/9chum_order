export type ShippingMethod = "FREE" | "DELIVERY_APP" | "COURIER"

export interface InvoiceLineInput {
  unitPrice: number
  quantity: number
}

export interface InvoiceTotals {
  lineTotals: number[]
  subtotal: number
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
): InvoiceTotals {
  assertNonNegativeInteger(requestedShippingFee, "Shipping fee")

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

  const shippingFee = shippingMethod === "FREE" ? 0 : requestedShippingFee
  const total = subtotal + shippingFee
  if (!Number.isSafeInteger(total)) {
    throw new Error("Total exceeds the supported amount")
  }

  return { lineTotals, subtotal, shippingFee, total }
}

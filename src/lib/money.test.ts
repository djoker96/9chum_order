import { describe, expect, it } from "vitest"
import { calculateInvoiceTotals } from "@/lib/money"

describe("calculateInvoiceTotals", () => {
  it("calculates line totals, subtotal, and shipping total", () => {
    const result = calculateInvoiceTotals(
      [
        { unitPrice: 150_000, quantity: 2 },
        { unitPrice: 250_000, quantity: 1 },
      ],
      50_000,
    )

    expect(result).toEqual({
      lineTotals: [300_000, 250_000],
      subtotal: 550_000,
      shippingFee: 50_000,
      total: 600_000,
    })
  })

  it("normalizes free shipping to zero", () => {
    const result = calculateInvoiceTotals(
      [{ unitPrice: 150_000, quantity: 1 }],
      50_000,
      "FREE",
    )

    expect(result.shippingFee).toBe(0)
    expect(result.total).toBe(150_000)
  })

  it("rejects invalid money inputs", () => {
    expect(() =>
      calculateInvoiceTotals([{ unitPrice: -1, quantity: 1 }], 0),
    ).toThrow("Unit price must be a non-negative integer")
  })

  it("rejects invalid quantities and negative shipping fees", () => {
    expect(() => calculateInvoiceTotals([{ unitPrice: 1, quantity: 0 }], 0)).toThrow("Quantity must be a positive integer")
    expect(() => calculateInvoiceTotals([], -1)).toThrow("Shipping fee must be a non-negative integer")
  })

  it("supports an empty cart for the realtime preview", () => {
    expect(calculateInvoiceTotals([], 0)).toEqual({ lineTotals: [], subtotal: 0, shippingFee: 0, total: 0 })
  })
})

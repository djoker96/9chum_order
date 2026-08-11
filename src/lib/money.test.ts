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
      discountType: "PERCENTAGE",
      discountValue: 0,
      discountAmount: 0,
      shippingFee: 50_000,
      total: 600_000,
    })
  })

  it("calculates a percentage discount and rounds to the nearest đồng", () => {
    const result = calculateInvoiceTotals(
      [{ unitPrice: 101, quantity: 1 }],
      20,
      "DELIVERY_APP",
      "PERCENTAGE",
      50,
    )

    expect(result).toEqual({
      lineTotals: [101],
      subtotal: 101,
      discountType: "PERCENTAGE",
      discountValue: 50,
      discountAmount: 51,
      shippingFee: 20,
      total: 70,
    })
  })

  it("calculates a fixed discount before adding shipping", () => {
    const result = calculateInvoiceTotals(
      [{ unitPrice: 300_000, quantity: 2 }],
      50_000,
      "DELIVERY_APP",
      "AMOUNT",
      100_000,
    )

    expect(result).toMatchObject({
      subtotal: 600_000,
      discountType: "AMOUNT",
      discountValue: 100_000,
      discountAmount: 100_000,
      shippingFee: 50_000,
      total: 550_000,
    })
  })

  it("allows a discount equal to the full subtotal without discounting shipping", () => {
    const result = calculateInvoiceTotals(
      [{ unitPrice: 100_000, quantity: 1 }],
      50_000,
      "DELIVERY_APP",
      "PERCENTAGE",
      100,
    )

    expect(result.discountAmount).toBe(100_000)
    expect(result.total).toBe(50_000)
  })

  it("allows a fixed discount equal to the subtotal", () => {
    const result = calculateInvoiceTotals(
      [{ unitPrice: 100_000, quantity: 1 }],
      50_000,
      "DELIVERY_APP",
      "AMOUNT",
      100_000,
    )

    expect(result.discountAmount).toBe(100_000)
    expect(result.total).toBe(50_000)
  })

  it("normalizes free shipping to zero", () => {
    const result = calculateInvoiceTotals(
      [{ unitPrice: 150_000, quantity: 1 }],
      50_000,
      "FREE",
    )

    expect(result.shippingFee).toBe(0)
    expect(result.discountAmount).toBe(0)
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

  it("rejects invalid discount values", () => {
    expect(() => calculateInvoiceTotals([], 0, "DELIVERY_APP", "PERCENTAGE", -1)).toThrow("Discount value must be a non-negative integer")
    expect(() => calculateInvoiceTotals([], 0, "DELIVERY_APP", "PERCENTAGE", 101)).toThrow("Discount percentage must be between 0 and 100")
    expect(() => calculateInvoiceTotals([{ unitPrice: 100, quantity: 1 }], 0, "DELIVERY_APP", "AMOUNT", 101)).toThrow("Discount amount must not exceed subtotal")
  })

  it("supports an empty cart for the realtime preview", () => {
    expect(calculateInvoiceTotals([], 0)).toEqual({
      lineTotals: [],
      subtotal: 0,
      discountType: "PERCENTAGE",
      discountValue: 0,
      discountAmount: 0,
      shippingFee: 0,
      total: 0,
    })
  })
})

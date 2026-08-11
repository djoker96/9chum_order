import { describe, expect, it } from "vitest"
import { createInvoiceSchema } from "@/server/validators/invoice.schema"

const validInput = {
  customerName: "Nguyễn Văn A",
  phone: "0901234567",
  address: "Hà Nội",
  items: [{ productId: "product-1", quantity: 2 }],
  paymentMethod: "BANK_TRANSFER" as const,
  shippingMethod: "DELIVERY_APP" as const,
  shippingFee: 50_000,
  issueInvoice: false,
}

describe("createInvoiceSchema", () => {
  it("accepts a valid invoice payload", () => {
    expect(createInvoiceSchema.parse(validInput)).toMatchObject({
      ...validInput,
      discountType: "PERCENTAGE",
      discountValue: 0,
    })
  })

  it("accepts percentage and fixed-amount discounts", () => {
    expect(createInvoiceSchema.parse({ ...validInput, discountType: "PERCENTAGE", discountValue: 15 })).toMatchObject({
      discountType: "PERCENTAGE",
      discountValue: 15,
    })
    expect(createInvoiceSchema.parse({ ...validInput, discountType: "AMOUNT", discountValue: 50_000 })).toMatchObject({
      discountType: "AMOUNT",
      discountValue: 50_000,
    })
  })

  it("accepts an optional warehouse choice", () => {
    expect(createInvoiceSchema.parse({ ...validInput, warehouse: "L7-21" })).toMatchObject({ warehouse: "L7-21" })
  })

  it("requires invoice information when invoice issuance is enabled", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInput,
      issueInvoice: true,
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["invoiceInfo"])
    }
  })

  it("rejects quantities below one and negative shipping fees", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInput,
      items: [{ productId: "product-1", quantity: 0 }],
      shippingFee: -1,
    })

    expect(result.success).toBe(false)
  })

  it("reports the discount value field for invalid discount input", () => {
    const percentageResult = createInvoiceSchema.safeParse({
      ...validInput,
      discountType: "PERCENTAGE",
      discountValue: 101,
    })
    const negativeResult = createInvoiceSchema.safeParse({
      ...validInput,
      discountType: "AMOUNT",
      discountValue: -1,
    })

    expect(percentageResult.success).toBe(false)
    expect(negativeResult.success).toBe(false)
    if (!percentageResult.success) expect(percentageResult.error.issues.some((issue) => issue.path.join(".") === "discountValue")).toBe(true)
    if (!negativeResult.success) expect(negativeResult.error.issues.some((issue) => issue.path.join(".") === "discountValue")).toBe(true)
  })

  it("does not accept client-provided calculated totals", () => {
    const result = createInvoiceSchema.parse({
      ...validInput,
      subtotal: 999_999,
      total: 999_999,
      discountAmount: 999_999,
    })

    expect(result).not.toHaveProperty("subtotal")
    expect(result).not.toHaveProperty("total")
    expect(result).not.toHaveProperty("discountAmount")
  })

  it("normalizes invoice information away when issuance is disabled", () => {
    const result = createInvoiceSchema.parse({
      ...validInput,
      issueInvoice: false,
      invoiceInfo: {
        companyName: "Should be removed",
        address: "Hà Nội",
        email: "invoice@example.com",
      },
    })

    expect(result.invoiceInfo).toBeUndefined()
  })

  it("accepts VAT data and normalizes free shipping", () => {
    const result = createInvoiceSchema.parse({
      ...validInput,
      shippingMethod: "FREE",
      shippingFee: 50_000,
      issueInvoice: true,
      invoiceInfo: { companyName: "ABC", address: "Hà Nội", email: "invoice@example.com" },
    })

    expect(result.shippingFee).toBe(0)
    expect(result.invoiceInfo?.companyName).toBe("ABC")
  })
})

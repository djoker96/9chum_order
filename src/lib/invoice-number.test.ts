import { describe, expect, it } from "vitest"
import { formatInvoiceNumber, formatInvoiceNumberDate } from "@/lib/invoice-number"

describe("invoice number", () => {
  it("uses DDMMYYYY and a four-digit sequence", () => {
    expect(formatInvoiceNumber(new Date("2026-08-10T00:00:00.000Z"), 1)).toBe("HD-10082026-0001")
    expect(formatInvoiceNumber(new Date("2026-08-10T00:00:00.000Z"), 42)).toBe("HD-10082026-0042")
  })

  it("formats the sequence date using the application timezone-independent date value", () => {
    expect(formatInvoiceNumberDate(new Date("2026-12-03T12:00:00.000Z"))).toBe("03122026")
  })

  it("rejects a sequence outside the display range", () => {
    expect(() => formatInvoiceNumber(new Date("2026-08-10T00:00:00.000Z"), 0)).toThrow()
    expect(() => formatInvoiceNumber(new Date("2026-08-10T00:00:00.000Z"), 10_000)).toThrow()
  })
})

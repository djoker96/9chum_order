import { describe, expect, it } from "vitest"
import { aggregateStatistics, getStatisticsRange, todayInVietnam } from "@/lib/statistics"

describe("statistics periods", () => {
  it("uses the calendar date in Vietnam", () => {
    expect(todayInVietnam(new Date("2026-08-20T16:59:59.000Z"))).toBe("2026-08-20")
    expect(todayInVietnam(new Date("2026-08-20T17:00:00.000Z"))).toBe("2026-08-21")
  })

  it("builds a Vietnam day with 24 hourly buckets", () => {
    const range = getStatisticsRange("day", "2026-08-21")

    expect(range.start.toISOString()).toBe("2026-08-20T17:00:00.000Z")
    expect(range.end.toISOString()).toBe("2026-08-21T17:00:00.000Z")
    expect(range.buckets).toHaveLength(24)
    expect(range.buckets[0]).toMatchObject({ key: "2026-08-21-00", label: "00h" })
    expect(range.buckets[23]).toMatchObject({ key: "2026-08-21-23", label: "23h" })
  })

  it("starts weeks on Monday across a year boundary", () => {
    const range = getStatisticsRange("week", "2025-01-01")

    expect(range.start.toISOString()).toBe("2024-12-29T17:00:00.000Z")
    expect(range.end.toISOString()).toBe("2025-01-05T17:00:00.000Z")
    expect(range.buckets.map((bucket) => bucket.key)).toEqual([
      "2024-12-30", "2024-12-31", "2025-01-01", "2025-01-02", "2025-01-03", "2025-01-04", "2025-01-05",
    ])
  })

  it("includes leap day in a monthly period", () => {
    const range = getStatisticsRange("month", "2024-02-12")

    expect(range.buckets).toHaveLength(29)
    expect(range.buckets.at(-1)?.key).toBe("2024-02-29")
    expect(range.end.toISOString()).toBe("2024-02-29T17:00:00.000Z")
  })

  it("uses the selected month to resolve quarters and years", () => {
    const quarter = getStatisticsRange("quarter", "2026-05-01")
    const year = getStatisticsRange("year", "2026-09-01")

    expect(quarter.buckets.map((bucket) => bucket.key)).toEqual(["2026-04", "2026-05", "2026-06"])
    expect(quarter.start.toISOString()).toBe("2026-03-31T17:00:00.000Z")
    expect(quarter.end.toISOString()).toBe("2026-06-30T17:00:00.000Z")
    expect(year.buckets).toHaveLength(12)
    expect(year.buckets[0]?.key).toBe("2026-01")
    expect(year.buckets.at(-1)?.key).toBe("2026-12")
  })
})

describe("statistics aggregation", () => {
  it("groups confirmed invoices and rounds commission per invoice", () => {
    const range = getStatisticsRange("day", "2026-08-21")
    const result = aggregateStatistics([
      { status: "CONFIRMED", total: 15, createdAt: new Date("2026-08-20T17:05:00.000Z") },
      { status: "CONFIRMED", total: 15, createdAt: new Date("2026-08-20T17:55:00.000Z") },
      { status: "CONFIRMED", total: 100, createdAt: new Date("2026-08-20T18:05:00.000Z") },
      { status: "CANCELLED", total: 1_000, createdAt: new Date("2026-08-20T18:15:00.000Z") },
    ], range)

    expect(result.summary).toEqual({ revenue: 130, commission: 14, invoiceCount: 3 })
    expect(result.buckets[0]).toMatchObject({ revenue: 30, commission: 4, invoiceCount: 2 })
    expect(result.buckets[1]).toMatchObject({ revenue: 100, commission: 10, invoiceCount: 1 })
    expect(result.buckets.slice(2).every((bucket) => bucket.revenue === 0 && bucket.commission === 0 && bucket.invoiceCount === 0)).toBe(true)
  })

  it("groups month, quarter and year data into the requested bucket units", () => {
    const month = aggregateStatistics([
      { status: "CONFIRMED", total: 100, createdAt: new Date("2024-02-28T17:00:00.000Z") },
    ], getStatisticsRange("month", "2024-02-01"))
    const quarter = aggregateStatistics([
      { status: "CONFIRMED", total: 200, createdAt: new Date("2026-04-30T17:00:00.000Z") },
    ], getStatisticsRange("quarter", "2026-05-01"))
    const year = aggregateStatistics([
      { status: "CONFIRMED", total: 300, createdAt: new Date("2026-11-30T17:00:00.000Z") },
    ], getStatisticsRange("year", "2026-01-01"))

    expect(month.buckets[28]).toMatchObject({ key: "2024-02-29", revenue: 100 })
    expect(quarter.buckets[1]).toMatchObject({ key: "2026-05", revenue: 200 })
    expect(year.buckets[11]).toMatchObject({ key: "2026-12", revenue: 300 })
  })
})

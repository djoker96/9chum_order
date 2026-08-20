const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export const STATISTICS_PERIODS = ["day", "week", "month", "quarter", "year"] as const
export type StatisticsPeriod = (typeof STATISTICS_PERIODS)[number]

interface CalendarDate {
  year: number
  month: number
  day: number
}

export interface StatisticsBucket {
  key: string
  label: string
  start: Date
  end: Date
}

export interface StatisticsRange {
  period: StatisticsPeriod
  label: string
  start: Date
  end: Date
  buckets: StatisticsBucket[]
}

export interface StatisticsInvoice {
  status: "CONFIRMED" | "CANCELLED"
  total: number
  createdAt: Date
}

export interface StatisticsBucketResult {
  key: string
  label: string
  revenue: number
  commission: number
  invoiceCount: number
}

export interface StatisticsSummary {
  revenue: number
  commission: number
  invoiceCount: number
}

export function calculateCommission(total: number): number {
  return Math.round(total * 0.1)
}

export function todayInVietnam(now = new Date()): string {
  return dateKey(vietnamCalendarDate(now))
}

export function isValidStatisticsDate(value: string): boolean {
  try {
    parseDate(value)
    return true
  } catch {
    return false
  }
}

export function getStatisticsRange(period: StatisticsPeriod, date: string): StatisticsRange {
  const selected = parseDate(date)
  let startDate = selected
  let endDate: CalendarDate

  if (period === "week") {
    const weekday = new Date(Date.UTC(selected.year, selected.month - 1, selected.day)).getUTCDay()
    startDate = addDays(selected, -(weekday === 0 ? 6 : weekday - 1))
    endDate = addDays(startDate, 7)
  } else if (period === "month") {
    startDate = { ...selected, day: 1 }
    endDate = addMonths(startDate, 1)
  } else if (period === "quarter") {
    startDate = { year: selected.year, month: Math.floor((selected.month - 1) / 3) * 3 + 1, day: 1 }
    endDate = addMonths(startDate, 3)
  } else if (period === "year") {
    startDate = { year: selected.year, month: 1, day: 1 }
    endDate = { year: selected.year + 1, month: 1, day: 1 }
  } else {
    endDate = addDays(startDate, 1)
  }

  const start = vietnamMidnight(startDate)
  const end = vietnamMidnight(endDate)
  const buckets = buildBuckets(period, startDate, start, end)

  return { period, label: rangeLabel(period, startDate, endDate), start, end, buckets }
}

export function aggregateStatistics(invoices: StatisticsInvoice[], range: StatisticsRange): {
  summary: StatisticsSummary
  buckets: StatisticsBucketResult[]
} {
  const buckets = range.buckets.map(({ key, label }) => ({ key, label, revenue: 0, commission: 0, invoiceCount: 0 }))
  const bucketIndexes = new Map(buckets.map((bucket, index) => [bucket.key, index]))
  const summary = { revenue: 0, commission: 0, invoiceCount: 0 }

  for (const invoice of invoices) {
    if (invoice.status !== "CONFIRMED" || invoice.createdAt < range.start || invoice.createdAt >= range.end) continue
    const bucketIndex = bucketIndexes.get(invoiceBucketKey(range.period, invoice.createdAt))
    if (bucketIndex === undefined) continue
    const commission = calculateCommission(invoice.total)
    const bucket = buckets[bucketIndex]
    bucket.revenue += invoice.total
    bucket.commission += commission
    bucket.invoiceCount += 1
    summary.revenue += invoice.total
    summary.commission += commission
    summary.invoiceCount += 1
  }

  return { summary, buckets }
}

function buildBuckets(period: StatisticsPeriod, startDate: CalendarDate, start: Date, end: Date): StatisticsBucket[] {
  if (period === "day") {
    return Array.from({ length: 24 }, (_, hour) => ({
      key: `${dateKey(startDate)}-${pad(hour)}`,
      label: `${pad(hour)}h`,
      start: new Date(start.getTime() + hour * HOUR_MS),
      end: new Date(start.getTime() + (hour + 1) * HOUR_MS),
    }))
  }

  if (period === "quarter" || period === "year") {
    const length = period === "quarter" ? 3 : 12
    return Array.from({ length }, (_, index) => {
      const bucketDate = addMonths(startDate, index)
      const nextDate = addMonths(bucketDate, 1)
      return {
        key: monthKey(bucketDate),
        label: `T${bucketDate.month}/${bucketDate.year}`,
        start: vietnamMidnight(bucketDate),
        end: vietnamMidnight(nextDate),
      }
    })
  }

  const length = Math.round((end.getTime() - start.getTime()) / DAY_MS)
  return Array.from({ length }, (_, index) => {
    const bucketDate = addDays(startDate, index)
    const nextDate = addDays(bucketDate, 1)
    const weekday = new Date(Date.UTC(bucketDate.year, bucketDate.month - 1, bucketDate.day)).getUTCDay()
    return {
      key: dateKey(bucketDate),
      label: period === "week" ? `${weekday === 0 ? "CN" : `T${weekday + 1}`} ${pad(bucketDate.day)}/${pad(bucketDate.month)}` : `${pad(bucketDate.day)}/${pad(bucketDate.month)}`,
      start: vietnamMidnight(bucketDate),
      end: vietnamMidnight(nextDate),
    }
  })
}

function invoiceBucketKey(period: StatisticsPeriod, date: Date): string {
  const local = new Date(date.getTime() + VIETNAM_OFFSET_MS)
  const calendarDate = { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate() }
  if (period === "day") return `${dateKey(calendarDate)}-${pad(local.getUTCHours())}`
  if (period === "quarter" || period === "year") return monthKey(calendarDate)
  return dateKey(calendarDate)
}

function rangeLabel(period: StatisticsPeriod, start: CalendarDate, end: CalendarDate): string {
  if (period === "day") return `Ngày ${pad(start.day)}/${pad(start.month)}/${start.year}`
  if (period === "week") {
    const lastDay = addDays(end, -1)
    return `${pad(start.day)}/${pad(start.month)}/${start.year} – ${pad(lastDay.day)}/${pad(lastDay.month)}/${lastDay.year}`
  }
  if (period === "month") return `Tháng ${pad(start.month)}/${start.year}`
  if (period === "quarter") return `Quý ${Math.floor((start.month - 1) / 3) + 1}/${start.year}`
  return `Năm ${start.year}`
}

function parseDate(value: string): CalendarDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error("Invalid date")
  const parsed = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
  const normalized = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
  if (normalized.getUTCFullYear() !== parsed.year || normalized.getUTCMonth() + 1 !== parsed.month || normalized.getUTCDate() !== parsed.day) {
    throw new Error("Invalid date")
  }
  return parsed
}

function vietnamCalendarDate(date: Date): CalendarDate {
  const local = new Date(date.getTime() + VIETNAM_OFFSET_MS)
  return { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate() }
}

function vietnamMidnight(date: CalendarDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day) - VIETNAM_OFFSET_MS)
}

function addDays(date: CalendarDate, days: number): CalendarDate {
  const result = new Date(Date.UTC(date.year, date.month - 1, date.day + days))
  return { year: result.getUTCFullYear(), month: result.getUTCMonth() + 1, day: result.getUTCDate() }
}

function addMonths(date: CalendarDate, months: number): CalendarDate {
  const result = new Date(Date.UTC(date.year, date.month - 1 + months, 1))
  return { year: result.getUTCFullYear(), month: result.getUTCMonth() + 1, day: 1 }
}

function dateKey(date: CalendarDate): string {
  return `${date.year}-${pad(date.month)}-${pad(date.day)}`
}

function monthKey(date: CalendarDate): string {
  return `${date.year}-${pad(date.month)}`
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

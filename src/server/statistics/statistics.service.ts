import { aggregateStatistics, calculateCommission, getStatisticsRange, type StatisticsPeriod, type StatisticsRange } from "@/lib/statistics"
import type { AuthenticatedUser } from "@/server/auth/permissions"
import { AppError } from "@/server/http/api"
import { statisticsRepository } from "@/server/statistics/statistics.repository"

export interface StaffStatisticsRecord {
  id: string
  email: string
  name: string | null
  isActive: boolean
}

export type StatisticsScope = { staffId: string } | { allStaff: true }

export interface ConfirmedInvoiceRecord {
  status: "CONFIRMED" | "CANCELLED"
  total: number
  createdAt: Date
  createdById: string
}

export interface StatisticsInvoiceRecord {
  id: string
  invoiceNumber: string
  customerName: string
  phone: string
  total: number
  status: "CONFIRMED" | "CANCELLED"
  createdAt: Date
  createdBy: { id: string; name: string | null; email: string }
}

export interface StatisticsListFilters {
  page: number
  pageSize: number
  search?: string
}

export interface StatisticsRepository {
  listStaff(): Promise<StaffStatisticsRecord[]>
  listConfirmedInvoices(range: StatisticsRange, scope: StatisticsScope): Promise<ConfirmedInvoiceRecord[]>
  listInvoices(range: StatisticsRange, scope: StatisticsScope, filters: StatisticsListFilters): Promise<{ invoices: StatisticsInvoiceRecord[]; total: number }>
}

export interface StatisticsQuery extends StatisticsListFilters {
  period: StatisticsPeriod
  date: string
  staffId?: string
}

export async function getStatistics(
  query: StatisticsQuery,
  user: AuthenticatedUser,
  repository: StatisticsRepository = statisticsRepository,
) {
  const staff = user.role === "ADMIN" ? await repository.listStaff() : []
  if (user.role === "ADMIN" && query.staffId && !staff.some((account) => account.id === query.staffId)) {
    throw new AppError(400, "INVALID_STAFF", "Nhân viên được chọn không hợp lệ.")
  }

  const range = getStatisticsRange(query.period, query.date)
  const selectedStaffId = user.role === "STAFF" ? user.id : query.staffId ?? null
  const scope: StatisticsScope = selectedStaffId ? { staffId: selectedStaffId } : { allStaff: true }
  const filters = { page: query.page, pageSize: query.pageSize, search: query.search }
  const [confirmedInvoices, invoiceList] = await Promise.all([
    repository.listConfirmedInvoices(range, scope),
    repository.listInvoices(range, scope, filters),
  ])
  const aggregate = aggregateStatistics(confirmedInvoices, range)

  return {
    viewerRole: user.role,
    selectedStaffId,
    period: { type: query.period, date: query.date, label: range.label, start: range.start, end: range.end },
    ...aggregate,
    staff,
    staffSummary: user.role === "ADMIN" && !selectedStaffId ? summarizeStaff(staff, confirmedInvoices) : [],
    invoices: invoiceList.invoices,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total: invoiceList.total,
      totalPages: Math.ceil(invoiceList.total / query.pageSize),
    },
  }
}

function summarizeStaff(staff: StaffStatisticsRecord[], invoices: ConfirmedInvoiceRecord[]) {
  const totals = new Map(staff.map((account) => [account.id, { revenue: 0, commission: 0, invoiceCount: 0 }]))
  for (const invoice of invoices) {
    if (invoice.status !== "CONFIRMED") continue
    const summary = totals.get(invoice.createdById)
    if (!summary) continue
    summary.revenue += invoice.total
    summary.commission += calculateCommission(invoice.total)
    summary.invoiceCount += 1
  }
  return staff.map((account) => ({ ...account, ...totals.get(account.id)! }))
}

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { StatisticsRepository, StatisticsScope } from "@/server/statistics/statistics.service"

function scopeWhere(scope: StatisticsScope): Prisma.InvoiceWhereInput {
  return "staffId" in scope ? { createdById: scope.staffId } : { createdBy: { is: { role: "STAFF" } } }
}

export const statisticsRepository: StatisticsRepository = {
  async listStaff() {
    return prisma.user.findMany({
      where: { role: "STAFF" },
      select: { id: true, email: true, name: true, isActive: true },
      orderBy: [{ isActive: "desc" }, { name: "asc" }, { email: "asc" }],
    })
  },

  async listConfirmedInvoices(range, scope) {
    const invoices = await prisma.invoice.findMany({
      where: { ...scopeWhere(scope), status: "CONFIRMED", createdAt: { gte: range.start, lt: range.end } },
      select: { status: true, total: true, createdAt: true, createdById: true },
    })
    return invoices.map((invoice) => ({ ...invoice, total: Number(invoice.total) }))
  },

  async listInvoices(range, scope, filters) {
    const search = filters.search?.trim()
    const where: Prisma.InvoiceWhereInput = {
      ...scopeWhere(scope),
      createdAt: { gte: range.start, lt: range.end },
      ...(search ? {
        OR: [
          { invoiceNumber: { contains: search, mode: "insensitive" } },
          { customerName: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      } : {}),
    }
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        select: {
          id: true,
          invoiceNumber: true,
          customerName: true,
          phone: true,
          total: true,
          status: true,
          createdAt: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      prisma.invoice.count({ where }),
    ])
    return { invoices: invoices.map((invoice) => ({ ...invoice, total: Number(invoice.total) })), total }
  },
}

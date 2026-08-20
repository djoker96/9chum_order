import { prisma } from "@/lib/prisma"
import { AppError } from "@/server/http/api"
import { serializeInvoice } from "@/server/invoices/invoice.service"
import type { InvoiceStatus, PaymentMethod, ShippingMethod } from "@prisma/client"

export interface InvoiceListFilters {
  page: number
  pageSize: number
  search?: string
  paymentMethod?: PaymentMethod
  shippingMethod?: ShippingMethod
  status?: InvoiceStatus
  dateFrom?: Date
  dateTo?: Date
}

export async function listInvoices(filters: InvoiceListFilters) {
  const search = filters.search?.trim()
  const where = {
    ...(search
      ? {
          OR: [
            { invoiceNumber: { contains: search, mode: "insensitive" as const } },
            { customerName: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
    ...(filters.shippingMethod ? { shippingMethod: filters.shippingMethod } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? { createdAt: { ...(filters.dateFrom ? { gte: filters.dateFrom } : {}), ...(filters.dateTo ? { lt: filters.dateTo } : {}) } }
      : {}),
  }

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      select: {
        id: true,
        invoiceNumber: true,
        customerName: true,
        phone: true,
        paymentMethod: true,
        shippingMethod: true,
        shippingFee: true,
        subtotal: true,
        total: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.invoice.count({ where }),
  ])

  return {
    invoices: invoices.map((invoice) => ({
      ...invoice,
      shippingFee: Number(invoice.shippingFee),
      subtotal: Number(invoice.subtotal),
      total: Number(invoice.total),
    })),
    pagination: { page: filters.page, pageSize: filters.pageSize, total, totalPages: Math.ceil(total / filters.pageSize) },
  }
}

export async function getInvoiceById(id: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true, createdBy: { select: { id: true, name: true } } },
  })
  if (!invoice) throw new AppError(404, "INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn.")
  return serializeInvoice(invoice)
}

export async function cancelInvoice(id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, select: { id: true, status: true } })
  if (!invoice) throw new AppError(404, "INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn.")
  if (invoice.status === "CANCELLED") {
    throw new AppError(409, "INVOICE_ALREADY_CANCELLED", "Hóa đơn đã được hủy.")
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: "CANCELLED" },
    include: { items: true, createdBy: { select: { id: true, name: true } } },
  })
  return serializeInvoice(updated)
}

export async function deleteInvoice(id: string): Promise<void> {
  const result = await prisma.invoice.deleteMany({ where: { id } })
  if (result.count === 0) throw new AppError(404, "INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn.")
}

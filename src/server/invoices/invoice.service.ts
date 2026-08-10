import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { calculateInvoiceTotals } from "@/lib/money"
import { formatInvoiceNumber, formatInvoiceNumberDate } from "@/lib/invoice-number"
import { AppError } from "@/server/http/api"
import type { CreateInvoiceInput } from "@/server/validators/invoice.schema"
import type { Warehouse } from "@/types/domain"

export interface InvoiceProduct {
  id: string
  name: string
  volume: string
  concentration: string
  price: number
  isActive: boolean
}

export interface InvoiceDraftItem {
  productId: string
  productName: string
  volume: string
  concentration: string
  unitPrice: number
  quantity: number
  lineTotal: number
}

export interface ResolvedInvoiceDraft {
  customerName: string
  phone: string
  address: string
  warehouse: Warehouse | null
  paymentMethod: CreateInvoiceInput["paymentMethod"]
  shippingMethod: CreateInvoiceInput["shippingMethod"]
  shippingFee: number
  subtotal: number
  total: number
  note: string | null
  issueInvoice: boolean
  companyName: string | null
  invoiceAddress: string | null
  invoiceEmail: string | null
  items: InvoiceDraftItem[]
}

export function resolveInvoiceDraft(input: CreateInvoiceInput, products: InvoiceProduct[]): ResolvedInvoiceDraft {
  const productsById = new Map(products.map((product) => [product.id, product]))
  const unavailable = input.items.some((item) => {
    const product = productsById.get(item.productId)
    return !product || !product.isActive
  })

  if (unavailable) {
    throw new AppError(409, "PRODUCT_INACTIVE", "Product không tồn tại hoặc đã ngừng bán.")
  }

  const items = input.items.map((item) => {
    const product = productsById.get(item.productId)
    if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm.")
    return {
      productId: product.id,
      productName: product.name,
      volume: product.volume,
      concentration: product.concentration,
      unitPrice: product.price,
      quantity: item.quantity,
      lineTotal: product.price * item.quantity,
    }
  })
  const totals = calculateInvoiceTotals(
    items.map(({ unitPrice, quantity }) => ({ unitPrice, quantity })),
    input.shippingFee,
    input.shippingMethod,
  )
  const invoiceInfo = input.issueInvoice ? input.invoiceInfo : undefined

  return {
    customerName: input.customerName,
    phone: input.phone,
    address: input.address,
    warehouse: input.warehouse ?? null,
    paymentMethod: input.paymentMethod,
    shippingMethod: input.shippingMethod,
    shippingFee: totals.shippingFee,
    subtotal: totals.subtotal,
    total: totals.total,
    note: input.note || null,
    issueInvoice: input.issueInvoice,
    companyName: invoiceInfo?.companyName ?? null,
    invoiceAddress: invoiceInfo?.address ?? null,
    invoiceEmail: invoiceInfo?.email ?? null,
    items,
  }
}

async function nextInvoiceNumber(tx: Prisma.TransactionClient, date: Date): Promise<string> {
  const dateKey = formatInvoiceNumberDate(date)
  const rows = await tx.$queryRaw<Array<{ last_value: number }>>`
    INSERT INTO "invoice_number_sequences" ("date_key", "last_value", "updated_at")
    VALUES (${dateKey}, 1, NOW())
    ON CONFLICT ("date_key") DO UPDATE
      SET "last_value" = "invoice_number_sequences"."last_value" + 1,
          "updated_at" = NOW()
    RETURNING "last_value"
  `
  const sequence = rows[0]?.last_value
  if (!sequence) throw new AppError(500, "INVOICE_NUMBER_FAILED", "Không thể sinh mã hóa đơn.")
  return formatInvoiceNumber(date, sequence)
}

function productFromDatabase(product: {
  id: string
  name: string
  volume: string
  concentration: string
  price: Prisma.Decimal
  isActive: boolean
}): InvoiceProduct {
  return { ...product, price: Number(product.price) }
}

export async function createInvoice(input: CreateInvoiceInput, createdById: string) {
  const productIds = [...new Set(input.items.map((item) => item.productId))]
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
  const draft = resolveInvoiceDraft(input, products.map(productFromDatabase))
  const createdAt = new Date()

  return prisma.$transaction(async (tx) => {
    const invoiceNumber = await nextInvoiceNumber(tx, createdAt)
    return tx.invoice.create({
      data: {
        invoiceNumber,
        customerName: draft.customerName,
        phone: draft.phone,
        address: draft.address,
        warehouse: draft.warehouse,
        paymentMethod: draft.paymentMethod,
        shippingMethod: draft.shippingMethod,
        shippingFee: draft.shippingFee,
        subtotal: draft.subtotal,
        total: draft.total,
        note: draft.note,
        issueInvoice: draft.issueInvoice,
        companyName: draft.companyName,
        invoiceAddress: draft.invoiceAddress,
        invoiceEmail: draft.invoiceEmail,
        createdById,
        createdAt,
        items: {
          create: draft.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            volume: item.volume,
            concentration: item.concentration,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            lineTotal: item.lineTotal,
          })),
        },
      },
      include: { items: true, createdBy: { select: { id: true, name: true } } },
    })
  })
}

export function serializeInvoice(invoice: {
  id: string
  invoiceNumber: string
  customerName: string
  phone: string
  address: string
  warehouse: string | null
  paymentMethod: string
  shippingMethod: string
  shippingFee: unknown
  subtotal: unknown
  total: unknown
  note: string | null
  issueInvoice: boolean
  companyName: string | null
  invoiceAddress: string | null
  invoiceEmail: string | null
  status: string
  createdAt: Date
  updatedAt: Date
  items: Array<{
    id: string
    productId: string | null
    productName: string
    volume: string
    concentration: string
    unitPrice: unknown
    quantity: number
    lineTotal: unknown
  }>
  createdBy?: { id: string; name: string | null } | null
}) {
  return {
    ...invoice,
    shippingFee: Number(invoice.shippingFee),
    subtotal: Number(invoice.subtotal),
    total: Number(invoice.total),
    items: invoice.items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
    })),
  }
}

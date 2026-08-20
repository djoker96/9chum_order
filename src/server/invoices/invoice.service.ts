import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { calculateInvoiceTotals, type DiscountType } from "@/lib/money"
import { formatInvoiceNumber, formatInvoiceNumberDate } from "@/lib/invoice-number"
import { AppError } from "@/server/http/api"
import type { CreateInvoiceInput, UpdateInvoiceInput } from "@/server/validators/invoice.schema"
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
  discountType: DiscountType
  discountValue: number
  discountAmount: number
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
  let totals
  try {
    totals = calculateInvoiceTotals(
      items.map(({ unitPrice, quantity }) => ({ unitPrice, quantity })),
      input.shippingFee,
      input.shippingMethod,
      input.discountType,
      input.discountValue,
    )
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Discount")) {
      const isExceeded = error.message === "Discount amount must not exceed subtotal"
      throw new AppError(
        400,
        isExceeded ? "DISCOUNT_EXCEEDS_SUBTOTAL" : "INVALID_DISCOUNT",
        isExceeded ? "Tiền giảm không được vượt quá tiền hàng." : error.message,
        { discountValue: [isExceeded ? "Tiền giảm không được vượt quá tiền hàng." : error.message] },
      )
    }
    throw error
  }
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
    discountType: totals.discountType,
    discountValue: totals.discountValue,
    discountAmount: totals.discountAmount,
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

function invoiceDataFromDraft(draft: ResolvedInvoiceDraft) {
  return {
    customerName: draft.customerName,
    phone: draft.phone,
    address: draft.address,
    warehouse: draft.warehouse,
    paymentMethod: draft.paymentMethod,
    shippingMethod: draft.shippingMethod,
    shippingFee: draft.shippingFee,
    subtotal: draft.subtotal,
    discountType: draft.discountType,
    discountValue: draft.discountValue,
    discountAmount: draft.discountAmount,
    total: draft.total,
    note: draft.note,
    issueInvoice: draft.issueInvoice,
    companyName: draft.companyName,
    invoiceAddress: draft.invoiceAddress,
    invoiceEmail: draft.invoiceEmail,
  }
}

function invoiceItemData(item: InvoiceDraftItem, productId: string | null = item.productId) {
  return {
    productId,
    productName: item.productName,
    volume: item.volume,
    concentration: item.concentration,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    lineTotal: item.lineTotal,
  }
}

function historicalItemReference(invoiceItemId: string): string {
  return `invoice-item:${invoiceItemId}`
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
        ...invoiceDataFromDraft(draft),
        invoiceNumber,
        createdById,
        createdAt,
        items: { create: draft.items.map((item) => invoiceItemData(item)) },
      },
      include: { items: true, createdBy: { select: { id: true, name: true } } },
    })
  })
}

export async function updateInvoice(id: string, input: UpdateInvoiceInput) {
  const existingInvoice = await prisma.invoice.findUnique({
    where: { id },
    select: { items: { select: { id: true, productId: true, productName: true, volume: true, concentration: true, unitPrice: true } } },
  })
  if (!existingInvoice) throw new AppError(404, "INVOICE_NOT_FOUND", "Không tìm thấy hóa đơn.")

  const productIds = [...new Set(input.items.flatMap((item) => item.productId ? [item.productId] : []))]
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
  const productsById = new Map(products.map((product) => [product.id, productFromDatabase(product)]))
  for (const item of existingInvoice.items) {
    const productReference = item.productId ?? historicalItemReference(item.id)
    productsById.set(productReference, {
      id: productReference,
      name: item.productName,
      volume: item.volume,
      concentration: item.concentration,
      price: Number(item.unitPrice),
      isActive: true,
    })
  }
  const draft = resolveInvoiceDraft({
    ...input,
    items: input.items.map((item) => ({ productId: item.productId ?? historicalItemReference(item.invoiceItemId!), quantity: item.quantity })),
  }, [...productsById.values()])
  const historicalItemIds = input.items.flatMap((item) => item.invoiceItemId ? [item.invoiceItemId] : [])
  const itemWrites = draft.items.map((item, index) => ({ item, invoiceItemId: input.items[index]?.invoiceItemId }))

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      ...invoiceDataFromDraft(draft),
      items: {
        deleteMany: historicalItemIds.length > 0 ? { id: { notIn: historicalItemIds } } : {},
        update: itemWrites.flatMap(({ item, invoiceItemId }) => invoiceItemId ? [{ where: { id: invoiceItemId }, data: invoiceItemData(item, null) }] : []),
        create: itemWrites.flatMap(({ item, invoiceItemId }) => invoiceItemId ? [] : [invoiceItemData(item)]),
      },
    },
    include: { items: true, createdBy: { select: { id: true, name: true } } },
  })
  return serializeInvoice(updated)
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
  discountType: DiscountType
  discountValue: unknown
  discountAmount: unknown
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
    discountValue: Number(invoice.discountValue),
    discountAmount: Number(invoice.discountAmount),
    total: Number(invoice.total),
    items: invoice.items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
    })),
  }
}

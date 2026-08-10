import { NextRequest } from "next/server"
import { z } from "zod"
import { createInvoice, serializeInvoice } from "@/server/invoices/invoice.service"
import { listInvoices } from "@/server/invoices/invoice.repository"
import { requireUser } from "@/server/auth/session"
import { errorResponse, successResponse } from "@/server/http/api"
import type { InvoiceStatus, PaymentMethod, ShippingMethod } from "@prisma/client"
import { createInvoiceSchema } from "@/server/validators/invoice.schema"
import { assertApiRateLimit, assertSameOrigin } from "@/server/http/security"

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  paymentMethod: z.enum(["BANK_TRANSFER", "COD"]).optional(),
  shippingMethod: z.enum(["FREE", "DELIVERY_APP", "COURIER"]).optional(),
  status: z.enum(["CONFIRMED", "CANCELLED"]).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    assertApiRateLimit(request, "invoice-create", 60)
    const user = await requireUser()
    const input = createInvoiceSchema.parse(await request.json())
    const invoice = await createInvoice(input, user.id)
    return successResponse({ invoice: serializeInvoice(invoice) }, 201)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireUser()
    assertApiRateLimit(request, "invoice-list")
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()))
    const result = await listInvoices({
      ...query,
      paymentMethod: query.paymentMethod as PaymentMethod | undefined,
      shippingMethod: query.shippingMethod as ShippingMethod | undefined,
      status: query.status as InvoiceStatus | undefined,
    })
    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}

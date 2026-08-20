import { NextRequest } from "next/server"
import { deleteInvoice, getInvoiceById } from "@/server/invoices/invoice.repository"
import { updateInvoice } from "@/server/invoices/invoice.service"
import { requireAdmin, requireUser } from "@/server/auth/session"
import { errorResponse, successResponse } from "@/server/http/api"
import { assertApiRateLimit, assertSameOrigin } from "@/server/http/security"
import { createInvoiceSchema } from "@/server/validators/invoice.schema"

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireUser()
    assertApiRateLimit(_request, "invoice-detail")
    const { id } = await context.params
    return successResponse({ invoice: await getInvoiceById(id) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request)
    assertApiRateLimit(request, "invoice-update", 30)
    await requireAdmin()
    const { id } = await context.params
    const input = createInvoiceSchema.parse(await request.json())
    return successResponse({ invoice: await updateInvoice(id, input) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request)
    assertApiRateLimit(request, "invoice-delete", 10)
    await requireAdmin()
    const { id } = await context.params
    await deleteInvoice(id)
    return successResponse({ deletedId: id })
  } catch (error) {
    return errorResponse(error)
  }
}

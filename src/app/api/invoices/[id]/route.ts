import { NextRequest } from "next/server"
import { getInvoiceById } from "@/server/invoices/invoice.repository"
import { requireUser } from "@/server/auth/session"
import { errorResponse, successResponse } from "@/server/http/api"
import { assertApiRateLimit } from "@/server/http/security"

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

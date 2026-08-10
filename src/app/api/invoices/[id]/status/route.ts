import { NextRequest } from "next/server"
import { z } from "zod"
import { cancelInvoice } from "@/server/invoices/invoice.repository"
import { requireAdmin } from "@/server/auth/session"
import { AppError, errorResponse, successResponse } from "@/server/http/api"
import { assertApiRateLimit, assertSameOrigin } from "@/server/http/security"

const statusSchema = z.object({ status: z.literal("CANCELLED") })

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request)
    assertApiRateLimit(request, "invoice-cancel", 30)
    await requireAdmin()
    const { id } = await context.params
    const input = statusSchema.parse(await request.json())
    if (input.status !== "CANCELLED") {
      throw new AppError(400, "VALIDATION_ERROR", "Trạng thái hóa đơn không hợp lệ.")
    }
    return successResponse({ invoice: await cancelInvoice(id) })
  } catch (error) {
    return errorResponse(error)
  }
}

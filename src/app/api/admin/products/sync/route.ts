import { NextRequest } from "next/server"
import { requireAdmin } from "@/server/auth/session"
import { syncProductsFromGoogleSheets } from "@/server/products/sync.service"
import { errorResponse, successResponse } from "@/server/http/api"
import { assertApiRateLimit, assertSameOrigin } from "@/server/http/security"

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    assertApiRateLimit(request, "product-sync", 5)
    const user = await requireAdmin()
    const result = await syncProductsFromGoogleSheets(user.id)
    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}

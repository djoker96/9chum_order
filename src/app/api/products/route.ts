import { NextRequest } from "next/server"
import { listActiveProducts } from "@/server/products/product.repository"
import { errorResponse, successResponse } from "@/server/http/api"
import { requireUser } from "@/server/auth/session"
import { assertApiRateLimit } from "@/server/http/security"

export async function GET(request: NextRequest) {
  try {
    await requireUser()
    assertApiRateLimit(request, "products")
    const search = request.nextUrl.searchParams.get("search")?.slice(0, 100)
    const result = await listActiveProducts({ search })
    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}

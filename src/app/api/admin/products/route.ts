import { NextRequest } from "next/server"
import { z } from "zod"
import { listProducts } from "@/server/products/product.repository"
import { errorResponse, successResponse } from "@/server/http/api"
import { requireAdmin } from "@/server/auth/session"
import { assertApiRateLimit } from "@/server/http/security"

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).default("ALL"),
})

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    assertApiRateLimit(request, "admin-products")
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()))
    const result = await listProducts({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search,
      status: query.status,
    })
    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}

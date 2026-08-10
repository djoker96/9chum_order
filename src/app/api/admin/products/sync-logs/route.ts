import { NextRequest } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/server/auth/session"
import { errorResponse, successResponse } from "@/server/http/api"
import { assertApiRateLimit } from "@/server/http/security"

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    assertApiRateLimit(request, "sync-logs")
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()))
    const [logs, total] = await Promise.all([
      prisma.productSyncLog.findMany({
        orderBy: { startedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.productSyncLog.count(),
    ])
    return successResponse({
      logs,
      pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

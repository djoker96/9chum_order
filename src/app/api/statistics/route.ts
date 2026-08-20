import { NextRequest } from "next/server"
import { z } from "zod"
import { isValidStatisticsDate, STATISTICS_PERIODS } from "@/lib/statistics"
import { requireUser } from "@/server/auth/session"
import { errorResponse, successResponse } from "@/server/http/api"
import { assertApiRateLimit } from "@/server/http/security"
import { getStatistics } from "@/server/statistics/statistics.service"

const querySchema = z.object({
  period: z.enum(STATISTICS_PERIODS),
  date: z.string().refine(isValidStatisticsDate, "Ngày không hợp lệ."),
  staffId: z.string().trim().min(1).max(100).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser()
    assertApiRateLimit(request, "statistics")
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()))
    return successResponse(await getStatistics(query, user))
  } catch (error) {
    return errorResponse(error)
  }
}

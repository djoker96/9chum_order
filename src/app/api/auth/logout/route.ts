import { NextRequest } from "next/server"
import { destroySession } from "@/server/auth/session"
import { errorResponse, successResponse } from "@/server/http/api"
import { assertApiRateLimit, assertSameOrigin } from "@/server/http/security"

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    assertApiRateLimit(request, "auth-logout", 30)
    await destroySession()
    return successResponse(null)
  } catch (error) {
    return errorResponse(error)
  }
}

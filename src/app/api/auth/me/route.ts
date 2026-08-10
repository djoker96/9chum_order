import { errorResponse, successResponse } from "@/server/http/api"
import { assertApiRateLimit } from "@/server/http/security"
import { requireUser } from "@/server/auth/session"

export async function GET(request: Request) {
  try {
    assertApiRateLimit(request, "auth-me")
    const user = await requireUser()
    return successResponse({ user })
  } catch (error) {
    return errorResponse(error)
  }
}

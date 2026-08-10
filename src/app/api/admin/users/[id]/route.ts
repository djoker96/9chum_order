import { NextRequest } from "next/server"
import { requireAdmin } from "@/server/auth/session"
import { errorResponse, successResponse } from "@/server/http/api"
import { assertApiRateLimit, assertSameOrigin } from "@/server/http/security"
import { updateUserSchema } from "@/server/users/user.schema"
import { updateUser } from "@/server/users/user.service"

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request)
    assertApiRateLimit(request, "admin-user-update", 60)
    const currentAdmin = await requireAdmin()
    const { id } = await context.params
    const parsed = updateUserSchema.parse(await request.json())
    const { passwordConfirmation: _passwordConfirmation, ...input } = parsed
    const result = await updateUser(id, input, currentAdmin.id)
    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}

import { NextRequest } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/server/auth/session"
import { errorResponse, successResponse } from "@/server/http/api"
import { assertApiRateLimit, assertSameOrigin } from "@/server/http/security"
import { createUserSchema } from "@/server/users/user.schema"
import { createUser, listUsers } from "@/server/users/user.service"

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional().transform((value) => value || undefined),
  role: z.enum(["ADMIN", "STAFF", "ALL"]).default("ALL"),
  status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).default("ALL"),
})

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
    assertApiRateLimit(request, "admin-users")
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()))
    const result = await listUsers(query)
    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    assertApiRateLimit(request, "admin-user-create", 30)
    await requireAdmin()
    const parsed = createUserSchema.parse(await request.json())
    const { passwordConfirmation: _passwordConfirmation, ...input } = parsed
    const result = await createUser(input)
    return successResponse(result, 201)
  } catch (error) {
    return errorResponse(error)
  }
}

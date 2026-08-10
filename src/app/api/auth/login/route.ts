import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { errorResponse, successResponse, AppError } from "@/server/http/api"
import { loginSchema } from "@/server/auth/login.schema"
import { allowLoginAttempt } from "@/server/auth/rate-limit"
import { verifyPassword } from "@/server/auth/password"
import { createSession } from "@/server/auth/session"
import { assertSameOrigin } from "@/server/http/security"

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    if (!allowLoginAttempt(ip)) {
      throw new AppError(429, "RATE_LIMITED", "Bạn thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.")
    }

    const input = loginSchema.parse(await request.json())
    const user = await prisma.user.findUnique({ where: { email: input.email } })
    const validPassword = user ? await verifyPassword(input.password, user.passwordHash) : false

    if (!user || !validPassword) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng.")
    }

    if (!user.isActive) {
      throw new AppError(403, "USER_DISABLED", "Tài khoản đã bị vô hiệu hóa.")
    }

    await createSession(user.id)
    return successResponse({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

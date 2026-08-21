import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { errorResponse, successResponse, AppError } from "@/server/http/api"
import { loginSchema } from "@/server/auth/login.schema"
import { clearLoginFailures, isLoginAttemptAllowed, recordLoginFailure } from "@/server/auth/rate-limit"
import { verifyPassword } from "@/server/auth/password"
import { createSession } from "@/server/auth/session"
import { assertSameOrigin, getClientIp } from "@/server/http/security"

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const input = loginSchema.parse(await request.json())
    const ip = getClientIp(request)
    if (!isLoginAttemptAllowed(input.email, ip)) {
      throw new AppError(429, "RATE_LIMITED", "Bạn thử đăng nhập quá nhiều lần. Vui lòng thử lại sau.")
    }

    const user = await prisma.user.findUnique({ where: { email: input.email } })
    const validPassword = user ? await verifyPassword(input.password, user.passwordHash) : false

    if (!user || !validPassword) {
      recordLoginFailure(input.email, ip)
      throw new AppError(401, "INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng.")
    }

    if (!user.isActive) {
      throw new AppError(403, "USER_DISABLED", "Tài khoản đã bị vô hiệu hóa.")
    }

    await createSession(user.id, input.rememberMe)
    clearLoginFailures(input.email)
    return successResponse({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (error) {
    return errorResponse(error)
  }
}

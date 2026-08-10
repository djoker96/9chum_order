import { AppError } from "@/server/http/api"
import { allowRateLimit } from "@/server/auth/rate-limit"

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin")
  if (!origin) return

  try {
    const requestUrl = new URL(request.url)
    const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || requestUrl.protocol.replace(":", "")
    const host = request.headers.get("host") || requestUrl.host
    const expectedOrigin = `${protocol}://${host}`
    if (new URL(origin).origin !== expectedOrigin) {
      throw new AppError(403, "CSRF_BLOCKED", "Yêu cầu không hợp lệ.")
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError(403, "CSRF_BLOCKED", "Yêu cầu không hợp lệ.")
  }
}

export function assertApiRateLimit(request: Request, scope: string, maxRequests = 120): void {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  if (!allowRateLimit(`api:${scope}:${ip}`, maxRequests, 60 * 1000)) {
    throw new AppError(429, "RATE_LIMITED", "Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau.")
  }
}

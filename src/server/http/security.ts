import { isIP } from "node:net"
import { AppError } from "@/server/http/api"
import { allowRateLimit } from "@/server/auth/rate-limit"

function getExpectedOrigin(request: Request): string {
  const configuredOrigin = process.env.APP_ORIGIN?.trim()
  if (configuredOrigin) {
    const parsedOrigin = new URL(configuredOrigin)
    if (parsedOrigin.origin !== configuredOrigin.replace(/\/$/, "")) {
      throw new Error("APP_ORIGIN must contain only an absolute origin")
    }
    return parsedOrigin.origin
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_ORIGIN is required in production")
  }

  return new URL(request.url).origin
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")
  const proxyAppendedAddress = forwardedFor?.split(",").at(-1)?.trim()
  return proxyAppendedAddress && isIP(proxyAppendedAddress)
    ? proxyAppendedAddress
    : "unknown"
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin")
  if (!origin) return

  try {
    const expectedOrigin = getExpectedOrigin(request)
    if (new URL(origin).origin !== expectedOrigin) {
      throw new AppError(403, "CSRF_BLOCKED", "Yêu cầu không hợp lệ.")
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError(403, "CSRF_BLOCKED", "Yêu cầu không hợp lệ.")
  }
}

export function assertApiRateLimit(request: Request, scope: string, maxRequests = 120): void {
  const ip = getClientIp(request)
  if (!allowRateLimit(`api:${scope}:${ip}`, maxRequests, 60 * 1000)) {
    throw new AppError(429, "RATE_LIMITED", "Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau.")
  }
}

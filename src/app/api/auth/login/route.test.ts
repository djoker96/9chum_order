import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { clearLoginFailures, isLoginAttemptAllowed, recordLoginFailure } from "@/server/auth/rate-limit"
import { verifyPassword } from "@/server/auth/password"
import { createSession } from "@/server/auth/session"
import { assertSameOrigin, getClientIp } from "@/server/http/security"
import { POST } from "@/app/api/auth/login/route"

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}))

vi.mock("@/server/auth/rate-limit", () => ({
  clearLoginFailures: vi.fn(),
  isLoginAttemptAllowed: vi.fn(),
  recordLoginFailure: vi.fn(),
}))

vi.mock("@/server/auth/password", () => ({ verifyPassword: vi.fn() }))
vi.mock("@/server/auth/session", () => ({ createSession: vi.fn() }))
vi.mock("@/server/http/security", () => ({
  assertSameOrigin: vi.fn(),
  getClientIp: vi.fn(),
}))

const user = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin",
  role: "ADMIN" as const,
  isActive: true,
  passwordHash: "hashed-password",
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getClientIp).mockReturnValue("203.0.113.7")
    vi.mocked(isLoginAttemptAllowed).mockReturnValue(true)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never)
    vi.mocked(verifyPassword).mockResolvedValue(true)
    vi.mocked(createSession).mockResolvedValue(new Date("2026-01-01T00:00:00.000Z"))
  })

  it("checks the normalized account and client IP before authenticating", async () => {
    const response = await POST(makeRequest({ email: " ADMIN@EXAMPLE.COM ", password: "secret" }))

    expect(response.status).toBe(200)
    expect(isLoginAttemptAllowed).toHaveBeenCalledWith("admin@example.com", "203.0.113.7")
    expect(clearLoginFailures).toHaveBeenCalledWith("admin@example.com")
  })

  it("records only invalid credentials as a login failure", async () => {
    vi.mocked(verifyPassword).mockResolvedValue(false)

    const response = await POST(makeRequest({ email: "admin@example.com", password: "wrong" }))

    expect(response.status).toBe(401)
    expect(recordLoginFailure).toHaveBeenCalledWith("admin@example.com", "203.0.113.7")
    expect(clearLoginFailures).not.toHaveBeenCalled()
  })

  it("does not query the database when the account is rate limited", async () => {
    vi.mocked(isLoginAttemptAllowed).mockReturnValue(false)

    const response = await POST(makeRequest({ email: "admin@example.com", password: "secret" }))
    const payload = await response.json()

    expect(response.status).toBe(429)
    expect(payload.error.code).toBe("RATE_LIMITED")
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it("validates credentials before consuming a login failure slot", async () => {
    const response = await POST(makeRequest({ email: "not-an-email", password: "secret" }))

    expect(response.status).toBe(400)
    expect(isLoginAttemptAllowed).not.toHaveBeenCalled()
    expect(recordLoginFailure).not.toHaveBeenCalled()
  })
})

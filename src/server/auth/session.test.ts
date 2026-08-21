import { beforeEach, describe, expect, it, vi } from "vitest"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { createSession } from "@/server/auth/session"

vi.mock("next/headers", () => ({ cookies: vi.fn() }))
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ AUTH_COOKIE_NAME: "session", AUTH_SESSION_TTL_DAYS: 7 }),
}))
vi.mock("@/lib/prisma", () => ({
  prisma: { session: { create: vi.fn() } },
}))
vi.mock("@/server/auth/session-token", () => ({
  createSessionToken: () => "raw-token",
  hashSessionToken: () => "hashed-token",
}))

describe("createSession", () => {
  const setCookie = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.setSystemTime(new Date("2026-08-21T00:00:00.000Z"))
    vi.mocked(cookies).mockResolvedValue({ set: setCookie } as never)
    vi.mocked(prisma.session.create).mockResolvedValue({} as never)
  })

  it("uses a browser-session cookie by default", async () => {
    await createSession("user-1", false)

    expect(setCookie).toHaveBeenCalledWith("session", "raw-token", {
      httpOnly: true,
      sameSite: "strict",
      secure: false,
      path: "/",
    })
  })

  it("persists the cookie until the session expires when login is remembered", async () => {
    await createSession("user-1", true)

    expect(setCookie).toHaveBeenCalledWith("session", "raw-token", expect.objectContaining({
      expires: new Date("2026-08-28T00:00:00.000Z"),
    }))
  })
})

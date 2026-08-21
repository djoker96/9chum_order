import { cookies } from "next/headers"
import { getServerEnv } from "@/lib/env"
import { prisma } from "@/lib/prisma"
import { AppError } from "@/server/http/api"
import { createSessionToken, hashSessionToken } from "@/server/auth/session-token"
import type { AuthenticatedUser } from "@/server/auth/permissions"

const DAY_IN_MS = 24 * 60 * 60 * 1000

function sessionCookieName(): string {
  return getServerEnv().AUTH_COOKIE_NAME
}

function toAuthenticatedUser(user: {
  id: string
  email: string
  name: string | null
  role: "ADMIN" | "STAFF"
}): AuthenticatedUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role }
}

export async function createSession(userId: string, rememberMe: boolean): Promise<Date> {
  const environment = getServerEnv()
  const rawToken = createSessionToken()
  const expiresAt = new Date(Date.now() + environment.AUTH_SESSION_TTL_DAYS * DAY_IN_MS)

  await prisma.session.create({
    data: { userId, tokenHash: hashSessionToken(rawToken), expiresAt },
  })

  const cookieStore = await cookies()
  cookieStore.set(sessionCookieName(), rawToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    ...(rememberMe && { expires: expiresAt }),
    path: "/",
  })

  return expiresAt
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies()
  const rawToken = cookieStore.get(sessionCookieName())?.value
  if (!rawToken) return null

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(rawToken) },
    select: {
      id: true,
      expiresAt: true,
      user: { select: { id: true, email: true, name: true, role: true, isActive: true } },
    },
  })

  if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
    await clearSessionCookie()
    if (session) await prisma.session.delete({ where: { id: session.id } })
    return null
  }

  return toAuthenticatedUser(session.user)
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser()
  if (!user) throw new AppError(401, "UNAUTHORIZED", "Vui lòng đăng nhập.")
  return user
}

export async function requireAdmin(): Promise<AuthenticatedUser> {
  const user = await requireUser()
  if (user.role !== "ADMIN") {
    throw new AppError(403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.")
  }
  return user
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  const rawToken = cookieStore.get(sessionCookieName())?.value

  if (rawToken) {
    await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(rawToken) } })
  }

  await clearSessionCookie()
}

async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(sessionCookieName(), "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  })
}

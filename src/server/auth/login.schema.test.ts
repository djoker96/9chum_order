import { describe, expect, it } from "vitest"
import { loginSchema } from "@/server/auth/login.schema"

describe("loginSchema", () => {
  it("accepts a normalized email and password", () => {
    expect(loginSchema.parse({ email: " ADMIN@example.com ", password: "secret" })).toEqual({
      email: "admin@example.com",
      password: "secret",
      rememberMe: false,
    })
  })

  it("accepts a request to remember the login", () => {
    expect(loginSchema.parse({ email: "admin@example.com", password: "secret", rememberMe: true }).rememberMe).toBe(true)
  })

  it("rejects malformed email or empty password", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "secret" }).success).toBe(false)
    expect(loginSchema.safeParse({ email: "admin@example.com", password: "" }).success).toBe(false)
  })
})

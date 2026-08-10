import { describe, expect, it } from "vitest"
import { loginSchema } from "@/server/auth/login.schema"

describe("loginSchema", () => {
  it("accepts a normalized email and password", () => {
    expect(loginSchema.parse({ email: " ADMIN@example.com ", password: "secret" })).toEqual({
      email: "admin@example.com",
      password: "secret",
    })
  })

  it("rejects malformed email or empty password", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "secret" }).success).toBe(false)
    expect(loginSchema.safeParse({ email: "admin@example.com", password: "" }).success).toBe(false)
  })
})

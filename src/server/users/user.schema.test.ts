import { describe, expect, it } from "vitest"
import { createUserSchema, updateUserSchema } from "@/server/users/user.schema"

describe("user schemas", () => {
  it("normalizes a valid new account", () => {
    const result = createUserSchema.parse({
      email: "  Staff@Example.COM ",
      name: " Nhân viên ",
      password: "a-secure-password",
      passwordConfirmation: "a-secure-password",
    })

    expect(result).toMatchObject({
      email: "staff@example.com",
      name: "Nhân viên",
      role: "STAFF",
      isActive: true,
    })
  })

  it("rejects short or mismatched passwords", () => {
    expect(createUserSchema.safeParse({
      email: "staff@example.com",
      password: "short",
      passwordConfirmation: "short",
    }).success).toBe(false)

    expect(createUserSchema.safeParse({
      email: "staff@example.com",
      password: "a-secure-password",
      passwordConfirmation: "another-password",
    }).success).toBe(false)
  })

  it("allows partial updates without a password", () => {
    expect(updateUserSchema.parse({ isActive: false })).toEqual({ isActive: false })
  })

  it("requires confirmation whenever an update includes a password", () => {
    expect(updateUserSchema.safeParse({ password: "a-secure-password" }).success).toBe(false)
    expect(updateUserSchema.safeParse({ passwordConfirmation: "a-secure-password" }).success).toBe(false)
    expect(updateUserSchema.parse({
      password: "a-secure-password",
      passwordConfirmation: "a-secure-password",
    })).toMatchObject({ password: "a-secure-password" })
  })
})

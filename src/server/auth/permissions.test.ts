import { describe, expect, it } from "vitest"
import { hasRole, isAdmin, type AuthenticatedUser } from "@/server/auth/permissions"

const staff: AuthenticatedUser = { id: "staff-1", email: "staff@example.com", name: "Staff", role: "STAFF" }
const admin: AuthenticatedUser = { id: "admin-1", email: "admin@example.com", name: "Admin", role: "ADMIN" }

describe("permissions", () => {
  it("recognizes admin users", () => {
    expect(isAdmin(admin)).toBe(true)
    expect(isAdmin(staff)).toBe(false)
  })

  it("allows only matching roles", () => {
    expect(hasRole(admin, "ADMIN")).toBe(true)
    expect(hasRole(staff, "ADMIN")).toBe(false)
    expect(hasRole(staff, "STAFF")).toBe(true)
  })
})

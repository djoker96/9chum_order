import { describe, expect, it, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"
import { AppError } from "@/server/http/api"
import { GET, POST } from "@/app/api/admin/users/route"
import { requireAdmin } from "@/server/auth/session"
import { createUser, listUsers } from "@/server/users/user.service"

vi.mock("@/server/auth/session", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/server/users/user.service", () => ({
  createUser: vi.fn(),
  listUsers: vi.fn(),
}))

const currentAdmin = { id: "admin-1", email: "admin@example.com", name: "Admin", role: "ADMIN" as const }

describe("/api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdmin).mockResolvedValue(currentAdmin)
    vi.mocked(listUsers).mockResolvedValue({ users: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } })
    vi.mocked(createUser).mockResolvedValue({
      id: "staff-1",
      email: "staff@example.com",
      name: "Staff",
      role: "STAFF",
      isActive: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    })
  })

  it("lists users with validated filters", async () => {
    const response = await GET(new NextRequest("http://localhost:3000/api/admin/users?page=2&pageSize=10&search=staff&role=STAFF&status=ACTIVE"))

    expect(response.status).toBe(200)
    expect(listUsers).toHaveBeenCalledWith({ page: 2, pageSize: 10, search: "staff", role: "STAFF", status: "ACTIVE" })
  })

  it("creates a user for an admin", async () => {
    const response = await POST(new NextRequest("http://localhost:3000/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "staff@example.com",
        name: "Staff",
        role: "STAFF",
        password: "a-secure-password",
        passwordConfirmation: "a-secure-password",
      }),
    }))

    expect(response.status).toBe(201)
    expect(createUser).toHaveBeenCalledWith({
      email: "staff@example.com",
      name: "Staff",
      role: "STAFF",
      isActive: true,
      password: "a-secure-password",
    })
  })

  it("returns forbidden when the caller is not an admin", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new AppError(403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này."))

    const response = await GET(new NextRequest("http://localhost:3000/api/admin/users"))

    expect(response.status).toBe(403)
    expect(listUsers).not.toHaveBeenCalled()
  })
})

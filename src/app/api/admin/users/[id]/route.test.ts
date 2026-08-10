import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { PATCH } from "@/app/api/admin/users/[id]/route"
import { requireAdmin } from "@/server/auth/session"
import { updateUser } from "@/server/users/user.service"

vi.mock("@/server/auth/session", () => ({
  requireAdmin: vi.fn(),
}))

vi.mock("@/server/users/user.service", () => ({
  updateUser: vi.fn(),
}))

describe("PATCH /api/admin/users/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireAdmin).mockResolvedValue({ id: "admin-1", email: "admin@example.com", name: "Admin", role: "ADMIN" })
    vi.mocked(updateUser).mockResolvedValue({
      id: "staff-1",
      email: "staff@example.com",
      name: "Staff",
      role: "STAFF",
      isActive: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    })
  })

  it("updates only the requested fields", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost:3000/api/admin/users/staff-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ id: "staff-1" }) },
    )

    expect(response.status).toBe(200)
    expect(updateUser).toHaveBeenCalledWith("staff-1", { isActive: false }, "admin-1")
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { UserAdmin } from "@/components/admin/user-admin"

const usersResponse = {
  success: true,
  data: {
    users: [{
      id: "staff-1",
      email: "staff@example.com",
      name: "Nhân viên",
      role: "STAFF",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }],
    pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
  },
}

function response(payload: unknown, ok = true): Response {
  return { ok, json: async () => payload } as Response
}

describe("UserAdmin", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockResolvedValue(response(usersResponse))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it("loads and renders the account list", async () => {
    render(<UserAdmin />)

    expect(await screen.findByText("staff@example.com")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Quản lý tài khoản" })).toBeInTheDocument()
    expect(screen.getByText("Nhân viên")).toBeInTheDocument()
  })

  it("creates an account from the inline form", async () => {
    fetchMock
      .mockResolvedValueOnce(response(usersResponse))
      .mockResolvedValueOnce(response({ success: true, data: usersResponse.data.users[0] }))
      .mockResolvedValueOnce(response(usersResponse))

    render(<UserAdmin />)
    await screen.findByText("staff@example.com")
    fireEvent.click(screen.getByRole("button", { name: "Tạo tài khoản" }))

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new@example.com" } })
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "a-secure-password" } })
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu"), { target: { value: "a-secure-password" } })
    fireEvent.click(screen.getByRole("button", { name: "Lưu tài khoản" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/users", expect.objectContaining({ method: "POST" })))
    const createCall = fetchMock.mock.calls[1]
    expect(JSON.parse(createCall[1].body as string)).toMatchObject({ email: "new@example.com", role: "STAFF" })
  })
})

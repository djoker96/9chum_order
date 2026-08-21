import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import HomePage from "@/app/page"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

describe("HomePage", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("renders the login form at the root route", () => {
    render(<HomePage />)

    expect(screen.getByText("Sử dụng tài khoản nhân viên được cấp.")).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("Mật khẩu")).toBeInTheDocument()
    expect(screen.getByLabelText("Lưu đăng nhập")).not.toBeChecked()
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toHaveAttribute("data-slot", "button")
  })

  it("submits the remember-login choice", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })))
    vi.stubGlobal("fetch", fetchMock)
    render(<HomePage />)

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@example.com" } })
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "secret" } })
    fireEvent.click(screen.getByLabelText("Lưu đăng nhập"))
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({
      body: JSON.stringify({ email: "admin@example.com", password: "secret", rememberMe: true }),
    })))
  })
})

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import HomePage from "@/app/page"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

describe("HomePage", () => {
  it("renders the login form at the root route", () => {
    render(<HomePage />)

    expect(screen.getByText("Sử dụng tài khoản nhân viên được cấp.")).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("Mật khẩu")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toHaveAttribute("data-slot", "button")
  })
})

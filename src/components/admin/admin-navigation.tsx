import Link from "next/link"
import { cn } from "@/lib/utils"

interface AdminNavigationProps {
  active: "products" | "users"
}

export function AdminNavigation({ active }: AdminNavigationProps) {
  return (
    <nav aria-label="Điều hướng quản trị" className="mb-6 flex flex-wrap items-center gap-2 text-xs">
      <span className="mr-2 font-semibold uppercase tracking-[0.18em] text-primary">Quản trị</span>
      <Link className={cn("rounded-md px-3 py-1.5 transition-colors hover:bg-muted", active === "products" && "bg-primary text-primary-foreground hover:bg-primary/80")} href="/admin/products">Sản phẩm</Link>
      <Link className={cn("rounded-md px-3 py-1.5 transition-colors hover:bg-muted", active === "users" && "bg-primary text-primary-foreground hover:bg-primary/80")} href="/admin/users">Tài khoản</Link>
    </nav>
  )
}

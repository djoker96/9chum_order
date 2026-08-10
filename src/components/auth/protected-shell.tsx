"use client"

import { ReactNode, useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"

interface ProtectedShellProps {
  children: ReactNode
  adminOnly?: boolean
}

export function ProtectedShell({ children, adminOnly = false }: ProtectedShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    let isMounted = true
    async function checkSession(): Promise<void> {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" })
        const payload = await response.json() as { success: boolean; data?: { user?: { role?: string } } }
        if (!response.ok || !payload.success || !payload.data?.user) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`)
          return
        }
        if (adminOnly && payload.data.user.role !== "ADMIN") {
          router.replace("/invoices")
          return
        }
        if (isMounted) setIsChecking(false)
      } catch {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`)
      }
    }
    void checkSession()
    return () => { isMounted = false }
  }, [adminOnly, pathname, router])

  if (isChecking) return <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6"><p className="text-sm text-muted-foreground">Đang kiểm tra phiên đăng nhập...</p></main>
  return children
}

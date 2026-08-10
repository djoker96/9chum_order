import type { ReactNode } from "react"
import { ProtectedShell } from "@/components/auth/protected-shell"

export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <ProtectedShell adminOnly>{children}</ProtectedShell>
}

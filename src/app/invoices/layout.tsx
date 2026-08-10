import type { ReactNode } from "react"
import { ProtectedShell } from "@/components/auth/protected-shell"

export default function InvoicesLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <ProtectedShell>{children}</ProtectedShell>
}

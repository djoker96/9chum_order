import type { Metadata } from "next"
import type { ReactNode } from "react"
import { GeistSans } from "geist/font/sans"
import "./globals.css"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Quản lý hóa đơn",
  description: "Quản lý và xuất hóa đơn nội bộ",
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi" className={cn("font-sans", GeistSans.variable)}>
      <body>{children}</body>
    </html>
  )
}

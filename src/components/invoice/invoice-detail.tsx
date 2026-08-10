"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeftIcon } from "@phosphor-icons/react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { InvoiceActions } from "@/components/invoice/invoice-actions"
import { InvoicePreview } from "@/components/invoice/invoice-preview"
import { formatVnd, type InvoiceOutputData } from "@/lib/invoice-text"
import type { InvoiceRecord } from "@/types/domain"

interface InvoiceDetailProps { id: string }

export function InvoiceDetail({ id }: InvoiceDetailProps) {
  const previewRef = useRef<HTMLElement>(null)
  const [invoice, setInvoice] = useState<InvoiceRecord | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    async function load(): Promise<void> {
      try {
        const [invoiceResponse, userResponse] = await Promise.all([fetch(`/api/invoices/${id}`), fetch("/api/auth/me")])
        const invoicePayload = await invoiceResponse.json() as { success: boolean; data?: { invoice: InvoiceRecord }; error?: { message?: string } }
        const userPayload = await userResponse.json() as { success: boolean; data?: { user?: { role?: string } } }
        if (!invoiceResponse.ok || !invoicePayload.success || !invoicePayload.data?.invoice) throw new Error(invoicePayload.error?.message || "Không thể tải hóa đơn.")
        if (isMounted) {
          setInvoice(invoicePayload.data.invoice)
          setIsAdmin(userPayload.data?.user?.role === "ADMIN")
        }
      } catch (loadError) {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : "Không thể tải hóa đơn.")
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    void load()
    return () => { isMounted = false }
  }, [id])

  async function cancel(): Promise<void> {
    if (!invoice || !window.confirm("Bạn có chắc muốn hủy hóa đơn này?")) return
    const response = await fetch(`/api/invoices/${invoice.id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "CANCELLED" }) })
    const payload = await response.json() as { success: boolean; data?: { invoice: InvoiceRecord }; error?: { message?: string } }
    if (!response.ok || !payload.success || !payload.data?.invoice) {
      setError(payload.error?.message || "Không thể hủy hóa đơn.")
      return
    }
    setInvoice(payload.data.invoice)
  }

  if (isLoading) return <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6"><p className="text-sm text-muted-foreground">Đang tải hóa đơn...</p></main>
  if (error || !invoice) return <main className="min-h-svh bg-muted/30 p-6"><div className="mx-auto flex max-w-5xl flex-col items-start gap-4"><Alert variant="destructive"><AlertDescription>{error || "Không tìm thấy hóa đơn."}</AlertDescription></Alert><Button variant="outline" nativeButton={false} render={<Link href="/invoices" />}><ArrowLeftIcon /> Quay lại lịch sử</Button></div></main>

  const outputInvoice: InvoiceOutputData = invoice
  return (
    <main className="min-h-svh bg-muted/30 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="mx-auto mb-6 flex max-w-5xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Chi tiết hóa đơn</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{invoice.invoiceNumber}</h1></div>
        <Button variant="outline" nativeButton={false} render={<Link href="/invoices" />}><ArrowLeftIcon /> Lịch sử</Button>
      </header>
      <section className="mx-auto grid max-w-5xl items-start gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div><InvoicePreview ref={previewRef} invoice={outputInvoice} /><InvoiceActions invoice={outputInvoice} targetRef={previewRef} /></div>
        <Card className="gap-0 shadow-sm">
          <CardContent className="grid gap-3 p-5">
            <Badge variant="outline" className={invoice.status === "CANCELLED" ? "w-fit border-destructive/30 bg-destructive/10 text-destructive" : "w-fit border-emerald-200 bg-emerald-50 text-emerald-700"}>{invoice.status === "CANCELLED" ? "Đã hủy" : "Đã xác nhận"}</Badge>
            <p className="mt-2 text-xs text-muted-foreground">Tổng đơn</p>
            <strong className="text-xl">{formatVnd(invoice.total)}</strong>
            <p className="mt-2 text-xs text-muted-foreground">Ngày tạo</p>
            <strong className="text-sm">{new Date(invoice.createdAt).toLocaleString("vi-VN")}</strong>
            {isAdmin && invoice.status !== "CANCELLED" && <Button className="mt-3" variant="destructive" type="button" onClick={() => void cancel()}>Hủy hóa đơn</Button>}
          </CardContent>
        </Card>
      </section>
    </main>
  )
}

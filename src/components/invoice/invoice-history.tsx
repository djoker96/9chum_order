"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { MagnifyingGlassIcon } from "@phosphor-icons/react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { InvoiceListItem } from "@/types/invoice-list"
import { formatVnd } from "@/lib/invoice-text"

interface InvoiceListResponse {
  invoices: InvoiceListItem[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

export function InvoiceHistory() {
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [result, setResult] = useState<InvoiceListResponse | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadInvoices = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" })
      if (search) params.set("search", search)
      const response = await fetch(`/api/invoices?${params.toString()}`)
      const payload = await response.json() as { success: boolean; data?: InvoiceListResponse; error?: { message?: string } }
      if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error?.message || "Không thể tải lịch sử hóa đơn.")
      setResult(payload.data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải lịch sử hóa đơn.")
    } finally {
      setIsLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadInvoices() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadInvoices])

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  return (
    <main className="min-h-svh bg-muted/30 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="mx-auto mb-6 flex max-w-7xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Hóa đơn</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Lịch sử hóa đơn</h1>
        </div>
        <Button nativeButton={false} render={<Link href="/invoices/create" />}><span aria-hidden="true">+</span> Tạo hóa đơn</Button>
      </header>
      <Card className="mx-auto w-full max-w-7xl gap-0 shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <form className="mb-6 flex flex-col gap-3 sm:flex-row" onSubmit={submitSearch}>
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input className="h-10 pl-9" aria-label="Tìm hóa đơn" placeholder="Tìm mã, tên khách hàng hoặc SĐT" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
            </div>
            <Button className="h-10" variant="outline" type="submit">Tìm kiếm</Button>
          </form>
          {error && <Alert className="mb-6" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Đang tải...</p>}
          {!isLoading && result?.invoices.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Chưa có hóa đơn phù hợp.</p>}
          {!isLoading && result && result.invoices.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã hóa đơn</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead>Tổng tiền</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell><Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link></TableCell>
                    <TableCell><div className="grid gap-1"><span>{invoice.customerName}</span><small className="text-muted-foreground">{invoice.phone}</small></div></TableCell>
                    <TableCell className="font-medium">{formatVnd(invoice.total)}</TableCell>
                    <TableCell><Badge variant="outline" className={invoice.status === "CANCELLED" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>{invoice.status === "CANCELLED" ? "Đã hủy" : "Đã xác nhận"}</Badge></TableCell>
                    <TableCell>{new Date(invoice.createdAt).toLocaleString("vi-VN")}</TableCell>
                    <TableCell><Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/invoices/${invoice.id}`}>Xem</Link></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {result && result.pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Trước</Button>
              <span className="text-sm text-muted-foreground">Trang {page} / {result.pagination.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= result.pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Sau</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

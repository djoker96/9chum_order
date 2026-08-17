"use client"

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AdminNavigation } from "@/components/admin/admin-navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { GoogleSheetConfig } from "@/components/admin/google-sheet-config"
import { formatVnd } from "@/lib/invoice-text"
import type { ProductVariant } from "@/types/domain"

interface ProductAdminResponse { products: ProductVariant[]; pagination: { total: number } }
interface SyncResult { created: number; updated: number; unchanged: number; deactivated: number; skipped: number; errors: number; details?: Array<{ row: number; message: string }> }

export function ProductAdmin() {
  const [result, setResult] = useState<ProductAdminResponse | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSheetConfigured, setIsSheetConfigured] = useState<boolean | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadProducts = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/products?status=ALL&pageSize=100")
      const payload = await response.json() as { success: boolean; data?: ProductAdminResponse; error?: { message?: string } }
      if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error?.message || "Không thể tải danh mục.")
      setResult(payload.data)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải danh mục.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadProducts() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadProducts])

  async function syncGoogleSheet(): Promise<void> {
    setIsSyncing(true); setMessage(null); setError(null)
    try {
      const response = await fetch("/api/admin/products/sync", { method: "POST" })
      const payload = await response.json() as { success: boolean; data?: SyncResult; error?: { message?: string } }
      if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error?.message || "Sync thất bại.")
      setMessage(`Sync xong: thêm ${payload.data.created}, cập nhật ${payload.data.updated}, vô hiệu hóa ${payload.data.deactivated}, không đổi ${payload.data.unchanged}, lỗi ${payload.data.errors}.`)
      await loadProducts()
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Sync thất bại.")
    } finally { setIsSyncing(false) }
  }

  async function importExcel(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    if (!file) return
    setIsSyncing(true); setMessage(null); setError(null)
    try {
      const formData = new FormData(); formData.append("file", file)
      const response = await fetch("/api/admin/products/import-excel", { method: "POST", body: formData })
      const payload = await response.json() as { success: boolean; data?: SyncResult; error?: { message?: string } }
      if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error?.message || "Import thất bại.")
      setMessage(`Import xong: thêm ${payload.data.created}, cập nhật ${payload.data.updated}, lỗi ${payload.data.errors}.`)
      await loadProducts()
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import thất bại.")
    } finally { setIsSyncing(false); event.target.value = "" }
  }

  return (
    <main className="min-h-svh bg-muted/30 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-7xl">
        <AdminNavigation active="products" />
        <header className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Quản trị</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Danh mục sản phẩm</h1>
          </div>
          <Button nativeButton={false} render={<Link href="/invoices/create" />}>Tạo hóa đơn</Button>
        </header>
      </div>
      <div className="mx-auto mt-6 w-full max-w-7xl">
        <GoogleSheetConfig onConfiguredChange={setIsSheetConfigured} />
      </div>
      <Card className="mx-auto w-full max-w-7xl gap-0 shadow-sm">
        <CardContent className="p-4 sm:p-6">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="text-sm text-muted-foreground"><strong className="text-2xl font-semibold text-foreground">{result?.pagination.total ?? 0}</strong><span> sản phẩm trong database</span></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" onClick={() => void syncGoogleSheet()} disabled={isSyncing || isSheetConfigured !== true}>{isSyncing ? "Đang sync..." : "Đồng bộ Google Sheets"}</Button>
              <Button variant="outline" type="button" onClick={() => fileInputRef.current?.click()} disabled={isSyncing}>Import Excel</Button>
              <input ref={fileInputRef} className="hidden" type="file" accept=".xlsx" onChange={(event) => void importExcel(event)} disabled={isSyncing} />
            </div>
          </div>
          {message && <Alert className="mb-4 border-emerald-200 bg-emerald-50 text-emerald-800"><AlertDescription>{message}</AlertDescription></Alert>}
          {error && <Alert className="mb-4" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {isLoading && <p className="py-8 text-center text-sm text-muted-foreground">Đang tải...</p>}
          {!isLoading && result?.products.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Chưa có sản phẩm.</p>}
          {!isLoading && result && result.products.length > 0 && (
            <Table>
              <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Sản phẩm</TableHead><TableHead>Biến thể</TableHead><TableHead>Giá</TableHead><TableHead>Trạng thái</TableHead></TableRow></TableHeader>
              <TableBody>{result.products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>{product.externalId}</TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.volume} · {product.concentration}</TableCell>
                  <TableCell>{formatVnd(product.price)}</TableCell>
                  <TableCell><Badge variant="outline" className={product.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-destructive/30 bg-destructive/10 text-destructive"}>{product.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

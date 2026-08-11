"use client"

import { FormEvent, useCallback, useEffect, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface GoogleSheetConfigView {
  configured: boolean
  spreadsheetUrl: string | null
  sheetName: string
  source: "database" | "environment" | "none"
  credentialsConfigured: boolean
  updatedAt: string | null
}

interface GoogleSheetConfigProps {
  onConfiguredChange?: (configured: boolean) => void
}

const REQUIRED_COLUMNS = [
  { name: "id", description: "Mã sản phẩm duy nhất" },
  { name: "product_name", description: "Tên sản phẩm" },
  { name: "concentration", description: "Nồng độ, ví dụ 10%" },
  { name: "volume", description: "Dung tích, ví dụ 30ml" },
  { name: "price", description: "Giá (VNĐ), không âm" },
  { name: "active", description: "TRUE/FALSE hoặc 1/0" },
] as const

function getErrorMessage(payload: { error?: { message?: string } }, fallback: string): string {
  return payload.error?.message || fallback
}

async function readApiPayload<T>(response: Response, fallback: string): Promise<T> {
  const contentType = response.headers?.get?.("content-type")?.toLowerCase() || ""
  if (contentType && !contentType.includes("application/json")) {
    if (response.status === 404) {
      throw new Error("API cấu hình Google Sheets chưa được triển khai trên server. Hãy deploy lại backend.")
    }
    throw new Error("Máy chủ trả về trang lỗi thay vì JSON. Vui lòng kiểm tra log backend.")
  }

  try {
    return await response.json() as T
  } catch {
    throw new Error(fallback)
  }
}

export function GoogleSheetConfig({ onConfiguredChange }: GoogleSheetConfigProps) {
  const [config, setConfig] = useState<GoogleSheetConfigView | null>(null)
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("")
  const [sheetName, setSheetName] = useState("Products")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadConfig = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/products/google-sheet-config", { cache: "no-store" })
      const payload = await readApiPayload<{ success: boolean; data?: GoogleSheetConfigView; error?: { message?: string } }>(response, "Không thể tải cấu hình Google Sheets.")
      if (!response.ok || !payload.success || !payload.data) throw new Error(getErrorMessage(payload, "Không thể tải cấu hình Google Sheets."))
      setConfig(payload.data)
      setSpreadsheetUrl(payload.data.spreadsheetUrl || "")
      setSheetName(payload.data.sheetName || "Products")
      onConfiguredChange?.(payload.data.configured && payload.data.credentialsConfigured)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Không thể tải cấu hình Google Sheets.")
    } finally {
      setIsLoading(false)
    }
  }, [onConfiguredChange])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadConfig() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadConfig])

  async function saveConfig(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsSaving(true)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch("/api/admin/products/google-sheet-config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ spreadsheetUrl, sheetName }),
      })
      const payload = await readApiPayload<{ success: boolean; data?: GoogleSheetConfigView; error?: { message?: string } }>(response, "Không thể lưu cấu hình Google Sheets.")
      if (!response.ok || !payload.success || !payload.data) throw new Error(getErrorMessage(payload, "Không thể lưu cấu hình Google Sheets."))
      setConfig(payload.data)
      setSpreadsheetUrl(payload.data.spreadsheetUrl || spreadsheetUrl.trim())
      setSheetName(payload.data.sheetName)
      const isReady = payload.data.configured && payload.data.credentialsConfigured
      onConfiguredChange?.(isReady)
      setMessage(isReady
        ? "Đã lưu cấu hình Google Sheets. Bạn có thể đồng bộ danh mục ngay."
        : "Đã lưu Sheet nhưng credential server chưa sẵn sàng để đồng bộ.")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu cấu hình Google Sheets.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="mb-6 shadow-sm">
      <CardHeader className="border-b">
        <CardTitle>Cấu hình Google Sheets</CardTitle>
        <CardDescription className="mt-1">Nhập URL Spreadsheet và tên tab chứa danh mục sản phẩm. Credential Service Account chỉ được đọc từ server.</CardDescription>
      </CardHeader>
      <CardContent className="pt-5">
        {message && <Alert className="mb-4 border-emerald-200 bg-emerald-50 text-emerald-800"><AlertDescription>{message}</AlertDescription></Alert>}
        {error && <Alert className="mb-4" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <form className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem_auto] lg:items-end" onSubmit={(event) => void saveConfig(event)}>
          <div className="space-y-2">
            <Label htmlFor="google-sheet-url">URL Google Sheet hoặc Spreadsheet ID</Label>
            <Input id="google-sheet-url" value={spreadsheetUrl} onChange={(event) => setSpreadsheetUrl(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." disabled={isLoading || isSaving} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="google-sheet-name">Tên tab</Label>
            <Input id="google-sheet-name" value={sheetName} onChange={(event) => setSheetName(event.target.value)} placeholder="Products" disabled={isLoading || isSaving} required />
          </div>
          <Button type="submit" disabled={isLoading || isSaving}>{isSaving ? "Đang lưu..." : "Lưu cấu hình"}</Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <span>Credential server: {config?.credentialsConfigured ? <strong className="text-emerald-700">đã cấu hình</strong> : <strong className="text-destructive">chưa cấu hình</strong>}</span>
          <span>Nguồn cấu hình: {config?.source === "database" ? "database" : config?.source === "environment" ? "environment" : "chưa có"}</span>
          {config?.updatedAt && <span>Cập nhật: {new Date(config.updatedAt).toLocaleString("vi-VN")}</span>}
        </div>
        {!config?.credentialsConfigured && !isLoading && <p className="mt-3 text-xs text-destructive">Hãy cấu hình GOOGLE_PROJECT_ID, GOOGLE_CLIENT_EMAIL và GOOGLE_PRIVATE_KEY trên server trước khi đồng bộ.</p>}

        <section className="mt-5 rounded-lg border bg-muted/20 p-4" aria-labelledby="google-sheet-columns-title">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
            <div>
              <h2 id="google-sheet-columns-title" className="text-sm font-semibold">Cột bắt buộc trong tab sản phẩm</h2>
              <p className="mt-1 text-xs text-muted-foreground">Dòng đầu tiên phải là tên cột bên dưới. Mỗi dòng sau là một sản phẩm.</p>
            </div>
            <a className="text-xs font-semibold text-primary underline-offset-4 hover:underline" href="/templates/products-import.csv" download="products-import.csv">
              Tải mẫu CSV
            </a>
          </div>
          <div className="mt-3 overflow-x-auto rounded-md border bg-background">
            <table className="w-full min-w-[32rem] text-left text-xs">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Tên cột</th>
                  <th className="px-3 py-2 font-medium">Ý nghĩa / giá trị hợp lệ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {REQUIRED_COLUMNS.map((column) => (
                  <tr key={column.name}>
                    <td className="px-3 py-2 font-mono font-medium">{column.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{column.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Sau khi tạo Sheet, chia sẻ cho email Service Account trên server với quyền <strong className="text-foreground">Viewer</strong>, rồi dán URL vào form này.</p>
        </section>
      </CardContent>
    </Card>
  )
}

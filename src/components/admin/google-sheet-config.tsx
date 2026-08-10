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

function getErrorMessage(payload: { error?: { message?: string } }, fallback: string): string {
  return payload.error?.message || fallback
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
      const payload = await response.json() as { success: boolean; data?: GoogleSheetConfigView; error?: { message?: string } }
      if (!response.ok || !payload.success || !payload.data) throw new Error(getErrorMessage(payload, "Không thể tải cấu hình Google Sheets."))
      setConfig(payload.data)
      setSpreadsheetUrl(payload.data.spreadsheetUrl || "")
      setSheetName(payload.data.sheetName || "Products")
      onConfiguredChange?.(payload.data.configured)
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
      const payload = await response.json() as { success: boolean; data?: GoogleSheetConfigView; error?: { message?: string } }
      if (!response.ok || !payload.success || !payload.data) throw new Error(getErrorMessage(payload, "Không thể lưu cấu hình Google Sheets."))
      setConfig(payload.data)
      setSpreadsheetUrl(payload.data.spreadsheetUrl || spreadsheetUrl.trim())
      setSheetName(payload.data.sheetName)
      onConfiguredChange?.(payload.data.configured)
      setMessage("Đã lưu cấu hình Google Sheets. Bạn có thể đồng bộ danh mục ngay.")
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
      </CardContent>
    </Card>
  )
}

import { google } from "googleapis"
import { getServerEnv } from "@/lib/env"
import { AppError } from "@/server/http/api"
import type { GoogleSheetSourceConfig } from "@/server/products/google-sheet-config"

const SHEET_COLUMNS = ["id", "product_name", "concentration", "volume", "price", "active"] as const

function normalizedHeader(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_")
}

export function valuesToProductRows(values: unknown[][]): Record<string, unknown>[] {
  if (values.length === 0) {
    throw new AppError(422, "GOOGLE_SHEET_INVALID_FORMAT", "Google Sheet không có dữ liệu sản phẩm.")
  }

  const headers = values[0].map(normalizedHeader)
  const duplicateHeaders = headers.filter((header, index) => header && headers.indexOf(header) !== index)
  const missingHeaders = SHEET_COLUMNS.filter((column) => !headers.includes(column))
  if (duplicateHeaders.length > 0 || missingHeaders.length > 0) {
    throw new AppError(422, "GOOGLE_SHEET_INVALID_FORMAT", `Google Sheet thiếu cột bắt buộc: ${missingHeaders.join(", ") || "tên cột bị trùng"}.`)
  }
  if (values.length < 2) {
    throw new AppError(422, "GOOGLE_SHEET_INVALID_FORMAT", "Google Sheet không có dữ liệu sản phẩm.")
  }

  return values.slice(1).map((row) =>
    headers.reduce<Record<string, unknown>>(
      (result, header, index) => ({ ...result, [header]: row[index] ?? "" }),
      {},
    ),
  )
}

export function buildProductsRange(sheetName: string): string {
  return `'${sheetName.replaceAll("'", "''")}'!A:F`
}

function googleApiStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null
  const candidate = error as { code?: unknown; response?: { status?: unknown } }
  const code = typeof candidate.code === "number" ? candidate.code : null
  const responseStatus = typeof candidate.response?.status === "number" ? candidate.response.status : null
  return responseStatus ?? code
}

export async function readGoogleSheetProductRows(config: GoogleSheetSourceConfig): Promise<Record<string, unknown>[]> {
  const environment = getServerEnv()
  if (!environment.GOOGLE_PROJECT_ID || !environment.GOOGLE_CLIENT_EMAIL || !environment.GOOGLE_PRIVATE_KEY) {
    throw new AppError(503, "GOOGLE_SHEET_ACCESS_DENIED", "Google Sheets chưa được cấu hình.")
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: environment.GOOGLE_CLIENT_EMAIL,
        private_key: environment.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        project_id: environment.GOOGLE_PROJECT_ID,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    })
    const sheets = google.sheets({ version: "v4", auth })
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range: buildProductsRange(config.sheetName),
    })
    const values = (response.data.values ?? []) as unknown[][]
    return valuesToProductRows(values)
  } catch (error) {
    if (error instanceof AppError) throw error
    const status = googleApiStatus(error)
    if (status === 401 || status === 403) {
      throw new AppError(503, "GOOGLE_SHEET_ACCESS_DENIED", "Không thể truy cập Google Sheet. Hãy kiểm tra quyền chia sẻ cho Service Account.")
    }
    if (status === 404) {
      throw new AppError(422, "GOOGLE_SHEET_INVALID_FORMAT", "Không tìm thấy Google Sheet hoặc tên tab.")
    }
    throw new AppError(502, "GOOGLE_SHEET_SYNC_FAILED", "Không thể đọc Google Sheet.")
  }
}

export { SHEET_COLUMNS }

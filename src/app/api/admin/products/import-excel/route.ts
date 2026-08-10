import { NextRequest } from "next/server"
import { requireAdmin } from "@/server/auth/session"
import { AppError, errorResponse, successResponse } from "@/server/http/api"
import { assertApiRateLimit, assertSameOrigin } from "@/server/http/security"
import { MAX_EXCEL_FILE_SIZE, parseExcelRows, validateExcelBuffer, validateExcelUpload } from "@/server/products/excel-import"
import { syncProductsFromRows } from "@/server/products/sync.service"

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    assertApiRateLimit(request, "excel-import", 5)
    const user = await requireAdmin()
    const contentLengthHeader = request.headers.get("content-length")
    const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader)
    if (contentLength !== null && (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > MAX_EXCEL_FILE_SIZE + 256 * 1024)) {
      throw new AppError(422, "EXCEL_INVALID_FILE", "File vượt quá giới hạn 5MB.")
    }
    const formData = await request.formData()
    const entry = formData.get("file")
    if (!(entry instanceof File)) {
      throw new AppError(400, "EXCEL_INVALID_FILE", "Vui lòng chọn file .xlsx.")
    }

    validateExcelUpload(entry)
    const buffer = await entry.arrayBuffer()
    validateExcelBuffer(buffer)
    const rawRows = await parseExcelRows(buffer)
    const result = await syncProductsFromRows(rawRows, user.id, "EXCEL")
    return successResponse(result)
  } catch (error) {
    return errorResponse(error)
  }
}

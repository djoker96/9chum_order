import readXlsxFile from "read-excel-file/node"
import { AppError } from "@/server/http/api"

export const MAX_EXCEL_FILE_SIZE = 5 * 1024 * 1024
export const MAX_EXCEL_ROWS = 10_000
export const MAX_EXCEL_COLUMNS = 32
const MAX_EXCEL_CELLS = 100_000

export function validateExcelUpload(file: File): void {
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new AppError(422, "EXCEL_INVALID_FILE", "Chỉ chấp nhận file .xlsx")
  }
  const allowedTypes = [
    "",
    "application/octet-stream",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]
  if (!allowedTypes.includes(file.type)) {
    throw new AppError(422, "EXCEL_INVALID_FILE", "Định dạng file Excel không hợp lệ.")
  }
  if (file.size > MAX_EXCEL_FILE_SIZE) {
    throw new AppError(422, "EXCEL_INVALID_FILE", "File vượt quá giới hạn 5MB")
  }
}

export function validateExcelBuffer(buffer: ArrayBuffer): void {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new AppError(422, "EXCEL_INVALID_FORMAT", "Nội dung file Excel không hợp lệ.")
  }
}

export function validateExcelRows(rows: unknown[][]): void {
  const headerRow = rows[0]
  const dataRows = rows.slice(1)
  if (!headerRow || headerRow.length === 0 || headerRow.every((value) => String(value ?? "").trim() === "") || dataRows.length === 0) {
    throw new AppError(422, "EXCEL_INVALID_FORMAT", "Excel không có dữ liệu sản phẩm.")
  }
  if (headerRow.length > MAX_EXCEL_COLUMNS) {
    throw new AppError(422, "EXCEL_INVALID_FORMAT", "Excel có quá nhiều cột.")
  }
  if (dataRows.length > MAX_EXCEL_ROWS) {
    throw new AppError(422, "EXCEL_INVALID_FORMAT", "Excel có quá nhiều dòng.")
  }
  const cellCount = rows.reduce((count, row) => count + row.length, 0)
  if (cellCount > MAX_EXCEL_CELLS) {
    throw new AppError(422, "EXCEL_INVALID_FORMAT", "Excel có quá nhiều ô dữ liệu.")
  }
}

export async function parseExcelRows(buffer: ArrayBuffer): Promise<Record<string, unknown>[]> {
  try {
    const excelBuffer = Buffer.from(buffer) as unknown as Parameters<typeof readXlsxFile>[0]
    const sheets = await readXlsxFile(excelBuffer)
    const rows = (sheets[0]?.data ?? []) as unknown[][]
    validateExcelRows(rows)
    const headers = (rows[0] ?? []).map((value) => String(value ?? "").trim())
    return rows.slice(1).map((row) => headers.reduce<Record<string, unknown>>((result, header, index) => ({
      ...result,
      [header]: row[index] ?? "",
    }), {}))
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError(422, "EXCEL_INVALID_FORMAT", "Không thể đọc nội dung file Excel.")
  }
}

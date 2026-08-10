import { describe, expect, it } from "vitest"
import {
  MAX_EXCEL_COLUMNS,
  MAX_EXCEL_ROWS,
  validateExcelBuffer,
  validateExcelRows,
  validateExcelUpload,
} from "@/server/products/excel-import"

describe("validateExcelUpload", () => {
  it("accepts a small xlsx upload", () => {
    const file = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], "products.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })

    expect(() => validateExcelUpload(file)).not.toThrow()
  })

  it("rejects wrong extensions and oversized files", () => {
    const wrongExtension = new File([new Uint8Array(10)], "products.csv", { type: "text/csv" })
    expect(() => validateExcelUpload(wrongExtension)).toThrow("Chỉ chấp nhận file .xlsx")

    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "products.xlsx")
    expect(() => validateExcelUpload(oversized)).toThrow("File vượt quá giới hạn 5MB")

    const wrongType = new File([new Uint8Array(10)], "products.xlsx", { type: "text/plain" })
    expect(() => validateExcelUpload(wrongType)).toThrow("Định dạng file Excel không hợp lệ")
  })

  it("rejects a non-ZIP payload even when the filename and MIME type look valid", () => {
    expect(() => validateExcelBuffer(new Uint8Array([0, 1, 2, 3]).buffer)).toThrow("Nội dung file Excel không hợp lệ")
  })

  it("rejects empty, overly wide, and overly long workbooks before syncing", () => {
    expect(() => validateExcelRows([])).toThrow("Excel không có dữ liệu sản phẩm")
    expect(() => validateExcelRows([
      Array.from({ length: MAX_EXCEL_COLUMNS + 1 }, () => "column"),
      ["value"],
    ])).toThrow("Excel có quá nhiều cột")
    expect(() => validateExcelRows([
      ["id"],
      ...Array.from({ length: MAX_EXCEL_ROWS + 1 }, (_, index) => [`SP${index}`]),
    ])).toThrow("Excel có quá nhiều dòng")
  })
})

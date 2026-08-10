import { describe, expect, it } from "vitest"
import { buildProductsRange, valuesToProductRows } from "@/server/products/google-sheets"

const headers = ["id", "product_name", "concentration", "volume", "price", "active"]

describe("Google Sheets product rows", () => {
  it("maps headers to product row objects regardless of column order", () => {
    expect(valuesToProductRows([
      ["product_name", "id", "active", "price", "volume", "concentration"],
      ["Sản phẩm A", "SP001", "TRUE", "150000", "30ml", "10%"],
    ])).toEqual([{
      product_name: "Sản phẩm A",
      id: "SP001",
      active: "TRUE",
      price: "150000",
      volume: "30ml",
      concentration: "10%",
    }])
  })

  it("rejects missing required headers and header-only sheets", () => {
    expect(() => valuesToProductRows([[...headers.slice(0, -1)], ["SP001"]])).toThrow("thiếu cột")
    expect(() => valuesToProductRows([headers])).toThrow("không có dữ liệu")
  })

  it("quotes tab names safely when building the A1 range", () => {
    expect(buildProductsRange("Products")).toBe("'Products'!A:F")
    expect(buildProductsRange("Kho ' chính")).toBe("'Kho '' chính'!A:F")
  })
})

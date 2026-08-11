import { describe, expect, it } from "vitest"
import {
  buildSpreadsheetUrl,
  parseGoogleSheetConfig,
  parseSpreadsheetId,
} from "@/server/products/google-sheet-config"

const spreadsheetId = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"

describe("Google Sheet configuration", () => {
  it("extracts a spreadsheet ID from a Google Sheets URL and trims the tab name", () => {
    expect(parseGoogleSheetConfig({
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`,
      sheetName: "  Products  ",
    })).toEqual({ spreadsheetId, sheetName: "Products" })
  })

  it("accepts the production Sheet URL with a gid query and fragment", () => {
    expect(parseGoogleSheetConfig({
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/1J6Y5ksppmZ5fWSsQxRQzFoP-5HyBX994-2D0WaR9eF8/edit?gid=0#gid=0",
      sheetName: "Products",
    })).toEqual({
      spreadsheetId: "1J6Y5ksppmZ5fWSsQxRQzFoP-5HyBX994-2D0WaR9eF8",
      sheetName: "Products",
    })
  })

  it("accepts a raw spreadsheet ID for administrators who already have it", () => {
    expect(parseSpreadsheetId(spreadsheetId)).toBe(spreadsheetId)
    expect(buildSpreadsheetUrl(spreadsheetId)).toBe(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`)
  })

  it("rejects non-Google URLs, malformed IDs, and control characters in tab names", () => {
    expect(() => parseSpreadsheetId("https://example.com/spreadsheets/d/not-google")).toThrow()
    expect(() => parseSpreadsheetId("short-id")).toThrow()
    expect(() => parseGoogleSheetConfig({
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
      sheetName: "Products\n!A:F",
    })).toThrow()
  })
})
